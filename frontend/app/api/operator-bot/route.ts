/**
 * Operator Bot Next.js API Route
 * 
 * Runs the operator bot as a Next.js API route for better integration with frontend.
 * Allows start/stop control via HTTP requests.
 */

import { ethers } from 'ethers'
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Bot state
let botRunning = false
let botInterval: NodeJS.Timeout | null = null
let provider: ethers.JsonRpcProvider | null = null
let wallet: ethers.Wallet | null = null
let vault: ethers.Contract | null = null
const processing = new Set<string>()
const failedClaims = new Map<string, any>()

// Configuration
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS
const VAULT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_VAULT_CHAIN_ID || '421614')
const RPC_URL = VAULT_CHAIN_ID === 11155111 
  ? process.env.ETHEREUM_SEPOLIA_RPC 
  : process.env.ARBITRUM_SEPOLIA_RPC
const OPERATOR_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const POLL_INTERVAL_MS = 5000

// Validate environment variables
function validateEnv() {
  if (!VAULT_ADDRESS) throw new Error('VAULT_ADDRESS not set')
  if (!RPC_URL) throw new Error('RPC_URL not set for chain ' + VAULT_CHAIN_ID)
  if (!OPERATOR_PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY not set')
}

// Load ABI
function loadABI() {
  try {
    const abiPath = path.join(process.cwd(), 'config', 'AsyncVault.abi.json')
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'))
  } catch (error) {
    console.error('Failed to load ABI:', error)
    throw new Error('Failed to load vault ABI')
  }
}

// Initialize provider and contract
async function initializeBot() {
  if (provider && wallet && vault) return // Already initialized

  validateEnv()
  
  provider = new ethers.JsonRpcProvider(RPC_URL)
  wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY!, provider)
  
  const vaultABI = loadABI()
  vault = new ethers.Contract(VAULT_ADDRESS!, vaultABI, wallet)
  
  // Verify network
  const network = await provider.getNetwork()
  console.log(`[Operator Bot] Connected to ${network.name} (Chain ${network.chainId})`)
  
  // Verify operator role
  const operator = await vault.operator()
  if (operator.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Bot address ${wallet.address} is not the operator (${operator})`)
  }
  console.log(`[Operator Bot] Operator role verified: ${wallet.address}`)
}

// Get active users with pending claims
async function getActiveUsers(): Promise<string[]> {
  if (!provider || !vault) return []
  
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 10000)

    const depositFilter = vault.filters.DepositRequested()
    const redeemFilter = vault.filters.RedeemRequested()

    const [depositEvents, redeemEvents] = await Promise.all([
      vault.queryFilter(depositFilter, fromBlock, currentBlock),
      vault.queryFilter(redeemFilter, fromBlock, currentBlock)
    ])

    const users = new Set<string>()
    depositEvents.forEach((event: any) => {
      const owner = event.args?.owner || event.args?.[0] || event.args?.user
      if (owner) users.add(owner)
    })
    redeemEvents.forEach((event: any) => {
      const owner = event.args?.owner || event.args?.[0] || event.args?.user
      if (owner) users.add(owner)
    })
    
    const usersWithPending: string[] = []
    for (const user of users) {
      const [pendingDeposit, pendingRedeem] = await Promise.all([
        vault.pendingDepositRequest(user),
        vault.pendingRedeemRequest(user)
      ])
      
      if (pendingDeposit > 0n || pendingRedeem > 0n) {
        usersWithPending.push(user)
      }
    }
    
    return usersWithPending
  } catch (error) {
    console.error('[Operator Bot] Error getting active users:', error)
    return []
  }
}

// Process deposit claim
async function processDepositClaim(userAddress: string, retryCount = 0): Promise<void> {
  if (!vault) return
  
  const lockKey = `deposit:${userAddress}`
  if (processing.has(lockKey)) return

  try {
    processing.add(lockKey)

    const pending = await vault.pendingDepositRequest(userAddress)
    
    if (pending > 0n) {
      const pendingFormatted = ethers.formatUnits(pending, 6)
      
      const tx = await vault.claimDepositFor(userAddress, { gasLimit: 200000 })
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`[Operator Bot] ✅ DEPOSIT CLAIMED: ${userAddress.slice(0, 10)}... | ${pendingFormatted} USDC`)
        failedClaims.delete(lockKey)
      }
    }
  } catch (error: any) {
    if (retryCount < 3 && !error.message?.includes('No pending request')) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      processing.delete(lockKey)
      return processDepositClaim(userAddress, retryCount + 1)
    }
    
    failedClaims.set(lockKey, {
      address: userAddress,
      type: 'deposit',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  } finally {
    processing.delete(lockKey)
  }
}

// Process redeem claim
async function processRedeemClaim(userAddress: string, retryCount = 0): Promise<void> {
  if (!vault) return
  
  const lockKey = `redeem:${userAddress}`
  if (processing.has(lockKey)) return

  try {
    processing.add(lockKey)

    const pendingShares = await vault.pendingRedeemRequest(userAddress)
    
    if (pendingShares > 0n) {
      const sharesFormatted = ethers.formatUnits(pendingShares, 6)
      
      const tx = await vault.claimRedeemFor(userAddress, { gasLimit: 200000 })
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`[Operator Bot] ✅ REDEEM CLAIMED: ${userAddress.slice(0, 10)}... | ${sharesFormatted} shares`)
        failedClaims.delete(lockKey)
      }
    }
  } catch (error: any) {
    if (retryCount < 3 && !error.message?.includes('No pending request')) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      processing.delete(lockKey)
      return processRedeemClaim(userAddress, retryCount + 1)
    }
    
    failedClaims.set(lockKey, {
      address: userAddress,
      type: 'redeem',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  } finally {
    processing.delete(lockKey)
  }
}

// Main polling loop
async function pollAndProcess() {
  try {
    const users = await getActiveUsers()
    
    if (users.length === 0) {
      return
    }

    console.log(`[Operator Bot] Processing ${users.length} pending claims...`)

    await Promise.allSettled([
      ...users.map(user => processDepositClaim(user)),
      ...users.map(user => processRedeemClaim(user))
    ])
  } catch (error) {
    console.error('[Operator Bot] Poll cycle error:', error)
  }
}

// Start bot loop
function startBotLoop() {
  if (botInterval) return
  
  console.log('[Operator Bot] Starting polling loop...')
  
  botInterval = setInterval(async () => {
    await pollAndProcess()
  }, POLL_INTERVAL_MS)
  
  // Run immediately
  pollAndProcess()
}

// Stop bot loop
function stopBotLoop() {
  if (botInterval) {
    clearInterval(botInterval)
    botInterval = null
    console.log('[Operator Bot] Stopped polling loop')
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'start') {
      if (!botRunning) {
        await initializeBot()
        startBotLoop()
        botRunning = true
        
        return NextResponse.json({
          status: 'started',
          running: true,
          message: 'Operator bot started successfully'
        })
      }
      
      return NextResponse.json({
        status: 'already_running',
        running: true,
        message: 'Operator bot is already running'
      })
    }
    
    if (action === 'stop') {
      if (botRunning) {
        stopBotLoop()
        botRunning = false
        
        return NextResponse.json({
          status: 'stopped',
          running: false,
          message: 'Operator bot stopped successfully'
        })
      }
      
      return NextResponse.json({
        status: 'already_stopped',
        running: false,
        message: 'Operator bot is not running'
      })
    }
    
    return NextResponse.json({
      error: 'Invalid action',
      validActions: ['start', 'stop']
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('[Operator Bot API] Error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    running: botRunning,
    processing: processing.size,
    failedClaims: failedClaims.size,
    vault: VAULT_ADDRESS,
    operator: wallet?.address || 'Not initialized'
  })
}

