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

// Configuration
const VAULT_ADDRESS = process.env.ASYNCVAULT_ADDRESS || process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Sepolia USDC
const RPC_URL = process.env.ETHEREUM_SEPOLIA_RPC
const SIMULATOR_PRIVATE_KEY = process.env.SIMULATOR_PRIVATE_KEY
const SIM_INTERVAL_MS = 60000 // 1 minute (for demo, production would be longer)
const MIN_AMOUNT_USDC = 0.01 // Minimum profit/loss amount
const MAX_AMOUNT_USDC = 0.5 // Maximum profit/loss amount

// Validate environment variables
function validateEnv() {
  if (!VAULT_ADDRESS) throw new Error('ASYNCVAULT_ADDRESS not set')
  if (!RPC_URL) throw new Error('ETHEREUM_SEPOLIA_RPC not set')
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

// Simulate market event (profit or loss)
async function simulateMarket() {
  if (!vault || !usdc || !wallet) return
  
  try {
    const random = Math.random()
    const isProfit = random > 0.5
    
    // Random amount between MIN and MAX
    const amount = (MIN_AMOUNT_USDC + Math.random() * (MAX_AMOUNT_USDC - MIN_AMOUNT_USDC)).toFixed(2)
    const amountWei = ethers.parseUnits(amount, 6)
    
    if (isProfit) {
      // Realize profit: Transfer USDC from simulator to vault
      console.log(`[Market Simulator] 📈 Realizing PROFIT: ${amount} USDC`)
      
      // Check simulator balance
      const balance = await usdc.balanceOf(wallet.address)
      if (balance < amountWei) {
        console.warn(`[Market Simulator] ⚠️  Insufficient USDC for profit (need ${amount}, have ${ethers.formatUnits(balance, 6)})`)
        return
      }
      
      const tx = await usdc.transfer(VAULT_ADDRESS, amountWei, { gasLimit: 100000 })
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`[Market Simulator] ✅ Profit realized: ${amount} USDC transferred to vault`)
      }
    } else {
      // Realize loss: Transfer USDC from vault to simulator
      console.log(`[Market Simulator] 📉 Realizing LOSS: ${amount} USDC`)
      
      // Call realizeLoss on vault (only owner can call this)
      try {
        const tx = await vault.realizeLoss(USDC_ADDRESS, amountWei, { gasLimit: 200000 })
        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          console.log(`[Market Simulator] ✅ Loss realized: ${amount} USDC withdrawn from vault`)
        }
      } catch (error: any) {
        if (error.message?.includes('Insufficient unreserved assets')) {
          console.warn(`[Market Simulator] ⚠️  Cannot realize loss: Insufficient unreserved assets in vault`)
        } else {
          throw error
        }
      }
    }
    
    // Log vault state
    const totalAssets = await vault.totalAssets()
    const totalSupply = await vault.totalSupply()
    const sharePrice = totalSupply > 0n 
      ? (Number(totalAssets) / Number(totalSupply)).toFixed(6)
      : '1.000000'
    
    console.log(`[Market Simulator] 💰 Vault: ${ethers.formatUnits(totalAssets, 6)} USDC | Share price: ${sharePrice}`)
  } catch (error) {
    console.error('[Market Simulator] Error simulating market:', error)
  }
}

// Start simulator loop
function startSimLoop() {
  if (simInterval) return
  
  console.log('[Market Simulator] Starting simulation loop...')
  console.log(`[Market Simulator] Frequency: Every ${SIM_INTERVAL_MS / 1000}s`)
  console.log(`[Market Simulator] Amount range: ${MIN_AMOUNT_USDC} - ${MAX_AMOUNT_USDC} USDC`)
  
  simInterval = setInterval(async () => {
    await simulateMarket()
  }, SIM_INTERVAL_MS)
  
  // Run immediately on start
  simulateMarket()
}

// Stop simulator loop
function stopSimLoop() {
  if (simInterval) {
    clearInterval(simInterval)
    simInterval = null
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
      // Manual trigger for testing
      if (!wallet || !vault || !usdc) {
        await initializeSimulator()
      }
      await simulateMarket()
      
      return NextResponse.json({
        status: 'triggered',
        message: 'Market event triggered manually'
      })
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
  
  if (usdc && wallet) {
    try {
      const bal = await usdc.balanceOf(wallet.address)
      balance = ethers.formatUnits(bal, 6) + ' USDC'
    } catch (error) {
      balance = 'Error fetching balance'
    }
  }
  
  return NextResponse.json({
    running: simRunning,
    vault: VAULT_ADDRESS,
    simulator: wallet?.address || 'Not initialized',
    balance,
    interval: `${SIM_INTERVAL_MS / 1000}s`,
    amountRange: `${MIN_AMOUNT_USDC} - ${MAX_AMOUNT_USDC} USDC`
  })
}

