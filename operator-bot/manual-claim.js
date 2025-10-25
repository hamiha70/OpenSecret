/**
 * Manual Claim Script
 * 
 * Use this to manually claim pending deposits/redeems if the bot isn't running.
 * Useful for recovering stuck requests.
 */

import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') })
dotenv.config({ path: join(__dirname, '../contracts-foundry/.env') })

// Configuration (FAIL FAST if missing)
const VAULT_ADDRESS = process.env.ASYNCVAULT_ADDRESS
const RPC_URL = process.env.ETHEREUM_SEPOLIA_RPC
const OPERATOR_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

// Validate required environment variables
if (!VAULT_ADDRESS) {
  console.error('❌ ERROR: ASYNCVAULT_ADDRESS not set in .env')
  console.error('   Please add: ASYNCVAULT_ADDRESS=0x...')
  process.exit(1)
}
if (!RPC_URL || !OPERATOR_PRIVATE_KEY) {
  console.error('❌ ERROR: Missing required environment variables in .env')
  process.exit(1)
}

// Get user address from command line
const USER_ADDRESS = process.argv[2]

if (!USER_ADDRESS) {
  console.error('❌ Usage: node manual-claim.js <USER_ADDRESS>')
  console.error('   Example: node manual-claim.js 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba')
  process.exit(1)
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🛠️  MANUAL CLAIM SCRIPT')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`👤 User: ${USER_ADDRESS}`)
console.log(`📍 Vault: ${VAULT_ADDRESS}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Load ABI
const vaultABI = JSON.parse(
  readFileSync(join(__dirname, '../frontend/config/AsyncVault.abi.json'), 'utf-8')
)

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider)
const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, wallet)

async function claimAll() {
  try {
    // Wait for network
    console.log('🔌 Connecting to network...')
    const network = await provider.getNetwork()
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})\n`)

    // Check pending deposit
    console.log('🔍 Checking pending deposit...')
    const pendingDeposit = await vault.pendingDepositRequest(USER_ADDRESS)
    
    if (pendingDeposit > 0n) {
      const amount = ethers.formatUnits(pendingDeposit, 6)
      console.log(`💰 Found pending deposit: ${amount} USDC`)
      console.log('⏳ Claiming deposit...')
      
      const tx = await vault.claimDepositFor(USER_ADDRESS, {
        gasLimit: 200000
      })
      
      console.log(`📤 Tx sent: ${tx.hash}`)
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`✅ Deposit claimed! Block: ${receipt.blockNumber}\n`)
      } else {
        console.log(`❌ Transaction failed\n`)
      }
    } else {
      console.log('   No pending deposit\n')
    }

    // Check pending redeem
    console.log('🔍 Checking pending redeem...')
    const pendingRedeem = await vault.pendingRedeemRequest(USER_ADDRESS)
    const pendingShares = pendingRedeem[0]
    
    if (pendingShares > 0n) {
      const shares = ethers.formatUnits(pendingShares, 6)
      console.log(`💸 Found pending redeem: ${shares} shares`)
      console.log('⏳ Claiming redeem...')
      
      const tx = await vault.claimRedeemFor(USER_ADDRESS, {
        gasLimit: 200000
      })
      
      console.log(`📤 Tx sent: ${tx.hash}`)
      const receipt = await tx.wait()
      
      if (receipt.status === 1) {
        console.log(`✅ Redeem claimed! Block: ${receipt.blockNumber}\n`)
      } else {
        console.log(`❌ Transaction failed\n`)
      }
    } else {
      console.log('   No pending redeem\n')
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ MANUAL CLAIM COMPLETE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

claimAll()

