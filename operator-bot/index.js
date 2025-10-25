/**
 * AsyncVault Operator Bot
 * 
 * Automatically claims deposits and redeems for users in parallel.
 * Monitors vault events and processes pending requests with proper error handling.
 */

import { ethers } from 'ethers'
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Setup error logging
const logDir = join(__dirname, 'logs')
if (!existsSync(logDir)) mkdirSync(logDir)
const errorLogPath = join(logDir, `errors-${new Date().toISOString().split('T')[0]}.log`)

function logError(message, error = null) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${message}${error ? '\n' + error.stack : ''}\n\n`
  appendFileSync(errorLogPath, logEntry)
}

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') })
dotenv.config({ path: join(__dirname, '../contracts-foundry/.env') })

// Configuration
const VAULT_ADDRESS = '0x8A73589fe295A64e9085708636cb04a29c9c4461'
const RPC_URL = process.env.ETHEREUM_SEPOLIA_RPC
const OPERATOR_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY // Deployer is also operator
const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

// Load ABI
const vaultABI = JSON.parse(
  readFileSync(join(__dirname, '../frontend/config/AsyncVault.abi.json'), 'utf-8')
)

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider)
const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, wallet)

// Tracking state
const processing = new Set() // Track addresses currently being processed
const failedClaims = new Map() // Track failed claims for reporting

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🤖 ASYNCVAULT OPERATOR BOT')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📍 Vault:    ${VAULT_ADDRESS}`)
console.log(`🔑 Operator: ${wallet.address}`)
console.log(`⏱️  Polling:  Every ${POLL_INTERVAL_MS / 1000}s`)
console.log(`📄 Errors:   ${errorLogPath}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

/**
 * Get all unique addresses that have interacted with the vault
 * by listening to past events
 */
async function getActiveUsers() {
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 10000) // Last ~10k blocks (~33 hours on Sepolia)

    // Get all deposit and redeem request events
    const depositFilter = vault.filters.DepositRequested()
    const redeemFilter = vault.filters.RedeemRequested()

    const [depositEvents, redeemEvents] = await Promise.all([
      vault.queryFilter(depositFilter, fromBlock, currentBlock),
      vault.queryFilter(redeemFilter, fromBlock, currentBlock)
    ])

    // Extract unique user addresses
    const users = new Set()
    depositEvents.forEach(event => {
      // Try multiple possible field names for the owner address
      const owner = event.args?.owner || event.args?.[0] || event.args?.user
      if (owner) {
        users.add(owner)
      }
    })
    redeemEvents.forEach(event => {
      const owner = event.args?.owner || event.args?.[0] || event.args?.user
      if (owner) {
        users.add(owner)
      }
    })

    // Clean one-line output
    console.log(`[Block ${currentBlock}] 👥 ${users.size} users | 📥 ${depositEvents.length} deposits | 📤 ${redeemEvents.length} redeems`)
    return Array.from(users)
  } catch (error) {
    logError('Error scanning for users', error)
    console.log(`[ERROR] Failed to scan - check logs/`)
    return []
  }
}

/**
 * Check if a user has a pending deposit and claim it
 */
async function processDepositClaim(userAddress, retryCount = 0) {
  const lockKey = `deposit:${userAddress}`
  
  // Check if already processing
  if (processing.has(lockKey)) {
    return
  }

  try {
    processing.add(lockKey)

    // Check pending deposit
    const pending = await vault.pendingDepositRequest(userAddress)
    
    if (pending > 0n) {
      const pendingFormatted = ethers.formatUnits(pending, 6) // USDC has 6 decimals
      
      // Claim deposit for user
      const tx = await vault.claimDepositFor(userAddress, {
        gasLimit: 200000 // Explicit gas limit
      })
      
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`✅ DEPOSIT CLAIMED: ${userAddress.slice(0, 10)}... | ${pendingFormatted} USDC → shares`)
        // Remove from failed claims if it was there
        failedClaims.delete(lockKey)
      } else {
        throw new Error('Transaction failed')
      }
    }
  } catch (error) {
    logError(`Deposit claim error for ${userAddress}`, error)
    
    // Retry logic
    if (retryCount < MAX_RETRIES && !error.message.includes('No pending request')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      processing.delete(lockKey)
      return processDepositClaim(userAddress, retryCount + 1)
    }
    
    // Track failed claim
    failedClaims.set(lockKey, {
      address: userAddress,
      type: 'deposit',
      error: error.message,
      timestamp: new Date().toISOString(),
      retries: retryCount
    })
    
    // Log warning for user
    console.warn(`⚠️  CLAIM DROPPED: ${userAddress.slice(0, 10)}... deposit | ${error.message.split('\n')[0]}`)
  } finally {
    processing.delete(lockKey)
  }
}

/**
 * Check if a user has a pending redeem and claim it
 */
async function processRedeemClaim(userAddress, retryCount = 0) {
  const lockKey = `redeem:${userAddress}`
  
  // Check if already processing
  if (processing.has(lockKey)) {
    return
  }

  try {
    processing.add(lockKey)

    // Check pending redeem
    const pendingResult = await vault.pendingRedeemRequest(userAddress)
    const pendingShares = pendingResult[0] // First return value is shares
    
    if (pendingShares > 0n) {
      const sharesFormatted = ethers.formatUnits(pendingShares, 6)
      
      // Claim redeem for user
      const tx = await vault.claimRedeemFor(userAddress, {
        gasLimit: 200000 // Explicit gas limit
      })
      
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`✅ REDEEM CLAIMED: ${userAddress.slice(0, 10)}... | ${sharesFormatted} shares → USDC`)
        // Remove from failed claims if it was there
        failedClaims.delete(lockKey)
      } else {
        throw new Error('Transaction failed')
      }
    }
  } catch (error) {
    logError(`Redeem claim error for ${userAddress}`, error)
    
    // Retry logic
    if (retryCount < MAX_RETRIES && !error.message.includes('No pending request')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      processing.delete(lockKey)
      return processRedeemClaim(userAddress, retryCount + 1)
    }
    
    // Track failed claim
    failedClaims.set(lockKey, {
      address: userAddress,
      type: 'redeem',
      error: error.message,
      timestamp: new Date().toISOString(),
      retries: retryCount
    })
    
    // Log warning for user
    console.warn(`⚠️  CLAIM DROPPED: ${userAddress.slice(0, 10)}... redeem | ${error.message.split('\n')[0]}`)
  } finally {
    processing.delete(lockKey)
  }
}

/**
 * Main polling loop
 */
async function pollAndProcess() {
  try {
    const users = await getActiveUsers()
    
    if (users.length === 0) {
      console.log('ℹ️  No users found yet, waiting for activity...')
      return
    }

    console.log(`🔄 Checking ${users.length} users for pending claims...`)

    // Process all users in parallel
    await Promise.allSettled([
      ...users.map(user => processDepositClaim(user)),
      ...users.map(user => processRedeemClaim(user))
    ])

    // No verbose output - clean logs only
  } catch (error) {
    console.error(`❌ Poll cycle error: ${error.message}`)
  }
}

/**
 * Event listeners for real-time processing
 */
function setupEventListeners() {
  console.log('👂 Setting up real-time event listeners...')

  vault.on('DepositRequested', async (owner, assets, event) => {
    try {
      const assetsFormatted = ethers.formatUnits(assets, 6)
      console.log(`🔔 NEW DEPOSIT: ${owner.slice(0, 10)}... | ${assetsFormatted} USDC | Block ${event.log.blockNumber}`)
      
      // Wait a bit for tx to settle, then process
      setTimeout(() => processDepositClaim(owner), 3000)
    } catch (error) {
      if (!error.message.includes('filter not found')) {
        logError('DepositRequested event handler error', error)
      }
    }
  })

  vault.on('RedeemRequested', async (owner, shares, event) => {
    try {
      const sharesFormatted = ethers.formatUnits(shares, 6)
      console.log(`🔔 NEW REDEEM: ${owner.slice(0, 10)}... | ${sharesFormatted} shares | Block ${event.log.blockNumber}`)
      
      // Wait a bit for tx to settle, then process
      setTimeout(() => processRedeemClaim(owner), 3000)
    } catch (error) {
      if (!error.message.includes('filter not found')) {
        logError('RedeemRequested event handler error', error)
      }
    }
  })

  console.log('✅ Event listeners active')
}

/**
 * Start the bot
 */
async function start() {
  try {
    // Wait for network to be ready
    await provider.getNetwork()
    const network = await provider.getNetwork()
    console.log(`✅ Connected: ${network.name} (Chain ${network.chainId})`)
    
    // Verify operator has correct role
    const operator = await vault.operator()
    if (operator.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`Bot address ${wallet.address} is not the operator (${operator})`)
    }
    console.log('✅ Operator role verified')

    // Setup real-time event listeners
    setupEventListeners()

    // Start polling loop
    console.log('🚀 Bot ready - watching for deposits & redeems...\n')
    while (true) {
      try {
        await pollAndProcess()
      } catch (pollError) {
        // Suppress "filter not found" errors (harmless, filters auto-recreate)
        if (pollError.message && pollError.message.includes('filter not found')) {
          // Silently ignore - this is expected behavior
        } else {
          logError('Poll cycle error', pollError)
          console.log(`[ERROR] Poll failed - check logs/`)
        }
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  } catch (error) {
    logError('Fatal bot error', error)
    console.error('\n❌ FATAL ERROR - Bot stopped. Check logs/')
    process.exit(1)
  }
}

// Suppress "filter not found" console errors globally
const originalConsoleError = console.error
console.error = function(...args) {
  const message = String(args[0] || '')
  // Suppress filter not found errors and ethers @TODO errors
  if (message.includes('filter not found') || 
      message.includes('@TODO') ||
      message.includes('eth_getFilterChanges')) {
    return
  }
  originalConsoleError.apply(console, args)
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  if (error.message && error.message.includes('filter not found')) {
    // Silently ignore
    return
  }
  logError('Unhandled promise rejection', error)
  console.log(`[ERROR] Unhandled rejection - check logs/`)
})

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down operator bot...')
  console.log(`📊 Final stats:`)
  console.log(`   • Currently processing: ${processing.size}`)
  console.log(`   • Failed claims: ${failedClaims.size}`)
  process.exit(0)
})

// Start the bot
start()

