/**
 * Market Simulator Next.js API Route
 * 
 * Simulates market conditions by randomly realizing profits or losses on the vault.
 * Transfers real USDC to/from the vault to demonstrate share price dynamics.
 */

import { ethers } from 'ethers'
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Bot state
let simRunning = false
let simInterval: NodeJS.Timeout | null = null
let provider: ethers.JsonRpcProvider | null = null
let wallet: ethers.Wallet | null = null
let vault: ethers.Contract | null = null
let usdc: ethers.Contract | null = null

// Transaction queue to prevent nonce collisions
let txQueue: Promise<any> = Promise.resolve()
let isProcessing = false

// Configuration - Geometric Brownian Motion Parameters
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' // Arbitrum Sepolia USDC
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC
const SIMULATOR_PRIVATE_KEY = process.env.SIMULATOR_PRIVATE_KEY

// Geometric Brownian Motion Configuration
let TARGET_APY = 0.10 // 10% annualized return
let MEAN_INTERVAL_MINUTES = 15 // Average 15 minutes between events
let VOLATILITY = 0.80 // 80% relative standard deviation

const EVENTS_PER_YEAR = () => 525600 / MEAN_INTERVAL_MINUTES // ~35,040 for 15min
const SIM_INTERVAL_MS = 60000 // Base polling interval (actual timing uses exponential distribution)

// Helper: Box-Muller transform for Gaussian random numbers
function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return z0 * stdDev + mean
}

// Helper: Exponential distribution for timing (memoryless property)
function exponentialRandom(mean: number): number {
  const u = Math.random()
  return -mean * Math.log(1 - u)
}

// Track next event time
let nextEventTime: number | null = null

// Validate environment variables
function validateEnv() {
  if (!VAULT_ADDRESS) throw new Error('VAULT_ADDRESS not set')
  if (!RPC_URL) throw new Error('ARBITRUM_SEPOLIA_RPC_URL not set')
  if (!SIMULATOR_PRIVATE_KEY) throw new Error('SIMULATOR_PRIVATE_KEY not set')
}

// Load ABIs
function loadABIs() {
  try {
    const vaultAbiPath = path.join(process.cwd(), 'config', 'AsyncVault.abi.json')
    const vaultABI = JSON.parse(fs.readFileSync(vaultAbiPath, 'utf-8'))
    
    // Minimal USDC ABI for transfer and balanceOf
    const usdcABI = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address account) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ]
    
    return { vaultABI, usdcABI }
  } catch (error) {
    console.error('Failed to load ABIs:', error)
    throw new Error('Failed to load ABIs')
  }
}

// Initialize provider and contracts
async function initializeSimulator() {
  if (provider && wallet && vault && usdc) return // Already initialized

  validateEnv()
  
  provider = new ethers.JsonRpcProvider(RPC_URL)
  wallet = new ethers.Wallet(SIMULATOR_PRIVATE_KEY!, provider)
  
  const { vaultABI, usdcABI } = loadABIs()
  vault = new ethers.Contract(VAULT_ADDRESS!, vaultABI, wallet)
  usdc = new ethers.Contract(USDC_ADDRESS, usdcABI, wallet)
  
  // Verify network
  const network = await provider.getNetwork()
  console.log(`[Market Simulator] Connected to ${network.name} (Chain ${network.chainId})`)
  console.log(`[Market Simulator] Simulator address: ${wallet.address}`)
  
  // Check USDC balance
  const balance = await usdc.balanceOf(wallet.address)
  const balanceFormatted = ethers.formatUnits(balance, 6)
  console.log(`[Market Simulator] USDC balance: ${balanceFormatted}`)
  
  if (balance < ethers.parseUnits('1', 6)) {
    console.warn(`[Market Simulator] WARNING: Low USDC balance (${balanceFormatted}). Fund simulator for losses.`)
  }
}

// Simulate market event using Geometric Brownian Motion
async function simulateMarket() {
  if (!vault || !usdc || !wallet) return
  
  try {
    // Get current vault balance
    const totalAssetsRaw = await vault.totalAssets()
    const totalAssets = Number(ethers.formatUnits(totalAssetsRaw, 6))
    
    // Handle zero balance edge case
    if (totalAssets === 0) {
      console.log('[Market Simulator] ⚠️  Vault balance is 0, skipping simulation')
      return
    }
    
    // Calculate relative profit using geometric Brownian motion
    const relProfitMean = TARGET_APY / EVENTS_PER_YEAR()
    const relProfitStdDev = relProfitMean * VOLATILITY
    const relProfit = gaussianRandom(relProfitMean, relProfitStdDev)
    
    // Calculate new balance and delta
    const newBalance = totalAssets * (1 + relProfit)
    let deltaUSDC = newBalance - totalAssets
    
    // NOTE: We removed totalReserved tracking after switching to Centrifuge pattern
    // The vault's ERC4626 implementation automatically handles reserve protection
    // via previewRedeem() and convertToAssets() during claim operations
    // 
    // We still cap losses to avoid trying to withdraw more than vault has:
    if (deltaUSDC < 0) {
      // Cap loss to current vault balance (can't go negative)
      deltaUSDC = Math.max(deltaUSDC, -totalAssets)
    }
    
    // Convert to wei (USDC has 6 decimals)
    // Round to nearest wei to avoid floating point issues
    const amountWei = BigInt(Math.round(Math.abs(deltaUSDC) * 1e6))
    
    // Skip if amount rounds to 0 wei
    if (amountWei === 0n) {
      console.log(`[Market Simulator] ⏭️  Amount rounds to 0 wei (${deltaUSDC.toFixed(9)} USDC), skipping`)
      return
    }
    
    const isProfit = deltaUSDC > 0
    console.log(`[Market Simulator] 🎲 ${isProfit ? '📈 PROFIT' : '📉 LOSS'}: ${ethers.formatUnits(amountWei, 6)} USDC (${(relProfit * 100).toFixed(4)}%)`)
    
    if (isProfit) {
      // Realize profit: Transfer USDC from simulator to vault
      
      // Check simulator balance
      const balance = await usdc.balanceOf(wallet.address)
      if (balance < amountWei) {
        console.warn(`[Market Simulator] ⚠️  Insufficient USDC for profit (need ${Math.abs(deltaUSDC).toFixed(6)}, have ${ethers.formatUnits(balance, 6)})`)
        return
      }
      
      // Step 1: Transfer USDC to vault
      const transferTx = await usdc.transfer(VAULT_ADDRESS, amountWei, { gasLimit: 100000 })
      const transferReceipt = await transferTx.wait()
      
      if (transferReceipt.status === 1) {
        console.log(`[Market Simulator] ✅ USDC transferred to vault: ${Math.abs(deltaUSDC).toFixed(6)} USDC`)
        
        // Step 2: Call realizeProfit() to emit event for tracking
        try {
          const profitTx = await vault.realizeProfit(USDC_ADDRESS, amountWei, { gasLimit: 100000 })
          const profitReceipt = await profitTx.wait()
          
          if (profitReceipt.status === 1) {
            console.log(`[Market Simulator] ✅ Profit event emitted on-chain`)
          }
        } catch (error: any) {
          console.warn(`[Market Simulator] ⚠️  Event emission failed (profit still applied): ${error.message}`)
        }
      }
    } else {
      // Realize loss: Transfer USDC from vault to simulator
      console.log(`[Market Simulator] 💰 Vault balance before: ${totalAssets.toFixed(6)} USDC`)
      
      // Call realizeLoss on vault (only owner can call this)
      try {
        const tx = await vault.realizeLoss(USDC_ADDRESS, amountWei, { gasLimit: 200000 })
        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          console.log(`[Market Simulator] ✅ Loss realized: ${Math.abs(deltaUSDC).toFixed(6)} USDC withdrawn from vault`)
        }
      } catch (error: any) {
        if (error.message?.includes('Insufficient unreserved assets')) {
          console.warn(`[Market Simulator] ⚠️  Cannot realize loss: Insufficient unreserved assets in vault`)
        } else {
          throw error
        }
      }
    }
    
    // Log vault state after event
    const newTotalAssets = await vault.totalAssets()
    const totalSupply = await vault.totalSupply()
    const sharePrice = totalSupply > 0n 
      ? (Number(newTotalAssets) / Number(totalSupply)).toFixed(6)
      : '1.000000'
    
    console.log(`[Market Simulator] 💰 Vault: ${ethers.formatUnits(newTotalAssets, 6)} USDC | Share price: ${sharePrice}`)
    
    // Schedule next event using exponential distribution
    const nextIntervalMinutes = exponentialRandom(MEAN_INTERVAL_MINUTES)
    nextEventTime = Date.now() + (nextIntervalMinutes * 60 * 1000)
    console.log(`[Market Simulator] ⏰ Next event in ${nextIntervalMinutes.toFixed(1)} minutes`)
    
  } catch (error) {
    console.error('[Market Simulator] Error simulating market:', error)
  }
}

// Start simulator loop
function startSimLoop() {
  if (simInterval) return
  
  console.log('[Market Simulator] Starting simulation loop...')
  console.log(`[Market Simulator] Model: Geometric Brownian Motion`)
  console.log(`[Market Simulator] Target APY: ${(TARGET_APY * 100).toFixed(1)}%`)
  console.log(`[Market Simulator] Mean Interval: ${MEAN_INTERVAL_MINUTES} minutes`)
  console.log(`[Market Simulator] Volatility: ${(VOLATILITY * 100).toFixed(0)}%`)
  console.log(`[Market Simulator] Events/Year: ~${EVENTS_PER_YEAR().toFixed(0)}`)
  
  // Initialize next event time
  nextEventTime = Date.now()
  
  simInterval = setInterval(async () => {
    // Check if it's time for the next event
    if (nextEventTime && Date.now() >= nextEventTime) {
      await simulateMarket()
    }
  }, SIM_INTERVAL_MS) // Check every minute
  
  // Run immediately on start
  simulateMarket()
}

// Stop simulator loop
function stopSimLoop() {
  if (simInterval) {
    clearInterval(simInterval)
    simInterval = null
    nextEventTime = null
    console.log('[Market Simulator] Stopped simulation loop')
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'start') {
      if (!simRunning) {
        await initializeSimulator()
        startSimLoop()
        simRunning = true
        
        return NextResponse.json({
          status: 'started',
          running: true,
          message: 'Market simulator started successfully'
        })
      }
      
      return NextResponse.json({
        status: 'already_running',
        running: true,
        message: 'Market simulator is already running'
      })
    }
    
    if (action === 'stop') {
      if (simRunning) {
        stopSimLoop()
        simRunning = false
        
        return NextResponse.json({
          status: 'stopped',
          running: false,
          message: 'Market simulator stopped successfully'
        })
      }
      
      return NextResponse.json({
        status: 'already_stopped',
        running: false,
        message: 'Market simulator is not running'
      })
    }
    
    if (action === 'trigger') {
      // Check if already processing a transaction
      if (isProcessing) {
        return NextResponse.json({ 
          status: 'busy',
          message: 'Transaction in progress, please wait...' 
        }, { status: 429 })
      }
      
      // Manual trigger for testing
      if (!wallet || !vault || !usdc) {
        await initializeSimulator()
      }
      
      // Queue the transaction to prevent nonce collisions
      isProcessing = true
      const result = await txQueue.then(async () => {
        try {
          await simulateMarket()
          return { status: 'triggered', message: 'Market event triggered manually' }
        } finally {
          isProcessing = false
        }
      }).catch((error) => {
        console.error('[Market Simulator] Queue error:', error.message)
        isProcessing = false
        throw error
      })
      
      return NextResponse.json(result)
    }
    
    return NextResponse.json({
      error: 'Invalid action',
      validActions: ['start', 'stop', 'trigger']
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('[Market Simulator API] Error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET() {
  let balance = 'Not initialized'
  let vaultBalance = 'Not initialized'
  let nextEventIn = null
  
  if (usdc && wallet) {
    try {
      const bal = await usdc.balanceOf(wallet.address)
      balance = ethers.formatUnits(bal, 6) + ' USDC'
    } catch (error) {
      balance = 'Error fetching balance'
    }
  }
  
  if (vault) {
    try {
      const assets = await vault.totalAssets()
      vaultBalance = ethers.formatUnits(assets, 6) + ' USDC'
    } catch (error) {
      vaultBalance = 'Error fetching balance'
    }
  }
  
  if (nextEventTime && simRunning) {
    const remaining = Math.max(0, nextEventTime - Date.now())
    nextEventIn = `${(remaining / 60000).toFixed(1)} minutes`
  }
  
  return NextResponse.json({
    running: simRunning,
    vault: VAULT_ADDRESS,
    simulator: wallet?.address || 'Not initialized',
    simulatorBalance: balance,
    vaultBalance,
    config: {
      targetAPY: `${(TARGET_APY * 100).toFixed(1)}%`,
      meanIntervalMinutes: MEAN_INTERVAL_MINUTES,
      volatility: `${(VOLATILITY * 100).toFixed(0)}%`,
      eventsPerYear: EVENTS_PER_YEAR().toFixed(0)
    },
    nextEventIn
  })
}

export async function PUT(request: NextRequest) {
  try {
    const { targetAPY, meanIntervalMinutes, volatility } = await request.json()
    
    // Validate inputs
    if (targetAPY !== undefined) {
      if (typeof targetAPY !== 'number' || targetAPY < 0 || targetAPY > 1) {
        return NextResponse.json({
          error: 'targetAPY must be a number between 0 and 1 (e.g., 0.10 for 10%)'
        }, { status: 400 })
      }
      TARGET_APY = targetAPY
    }
    
    if (meanIntervalMinutes !== undefined) {
      if (typeof meanIntervalMinutes !== 'number' || meanIntervalMinutes <= 0) {
        return NextResponse.json({
          error: 'meanIntervalMinutes must be a positive number'
        }, { status: 400 })
      }
      MEAN_INTERVAL_MINUTES = meanIntervalMinutes
    }
    
    if (volatility !== undefined) {
      if (typeof volatility !== 'number' || volatility < 0) {
        return NextResponse.json({
          error: 'volatility must be a non-negative number (e.g., 0.80 for 80%)'
        }, { status: 400 })
      }
      VOLATILITY = volatility
    }
    
    console.log('[Market Simulator] Configuration updated:')
    console.log(`  Target APY: ${(TARGET_APY * 100).toFixed(1)}%`)
    console.log(`  Mean Interval: ${MEAN_INTERVAL_MINUTES} minutes`)
    console.log(`  Volatility: ${(VOLATILITY * 100).toFixed(0)}%`)
    
    return NextResponse.json({
      status: 'updated',
      config: {
        targetAPY: TARGET_APY,
        meanIntervalMinutes: MEAN_INTERVAL_MINUTES,
        volatility: VOLATILITY,
        eventsPerYear: EVENTS_PER_YEAR()
      }
    })
    
  } catch (error: any) {
    console.error('[Market Simulator Config] Error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

