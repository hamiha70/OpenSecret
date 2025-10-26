'use client'

import { useState, useEffect, useRef } from 'react'
import { BridgeButton, useNexus } from '@avail-project/nexus-widgets'
import { CONTRACTS, VAULT_CHAIN_HEX, VAULT_CHAIN_NAME, VAULT_CHAIN_ID } from '../config/contracts'
import AsyncVaultABI from '../config/AsyncVault.abi.json'

export default function Home() {
  const { setProvider } = useNexus()
  const [status, setStatus] = useState('Initializing...')
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [usdcBalance, setUsdcBalance] = useState('')
  const [vaultShares, setVaultShares] = useState('')
  const [vaultUSDCBalance, setVaultUSDCBalance] = useState('') // Total USDC in vault
  const [pendingDeposit, setPendingDeposit] = useState('')
  const [pendingRedeem, setPendingRedeem] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'in_progress' | 'success' | 'failed'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [operatorBotEnabled, setOperatorBotEnabled] = useState(false)
  
  // Cross-chain deposit state
  // ✅ Smart default: If vault is on Arbitrum Sepolia, default to Ethereum Sepolia (most stable for Avail)
  //    If vault is on Ethereum Sepolia, default to Base Sepolia
  const getDefaultSourceChain = (): 'sepolia' | 'arbitrum-sepolia' | 'base-sepolia' | 'optimism-sepolia' | 'polygon-amoy' => {
    if (VAULT_CHAIN_ID === 421614) return 'sepolia'        // Vault on Arbitrum → Default Ethereum Sepolia
    if (VAULT_CHAIN_ID === 11155111) return 'base-sepolia' // Vault on Ethereum → Default Base Sepolia
    if (VAULT_CHAIN_ID === 84532) return 'sepolia'         // Vault on Base → Default Ethereum Sepolia
    return 'sepolia' // Fallback to most stable
  }
  const [sourceChain, setSourceChain] = useState<'sepolia' | 'arbitrum-sepolia' | 'base-sepolia' | 'optimism-sepolia' | 'polygon-amoy'>(getDefaultSourceChain())
  const [crossChainAmount, setCrossChainAmount] = useState('')
  const [crossChainStep, setCrossChainStep] = useState<'idle' | 'switch_needed' | 'bridging' | 'bridge_complete' | 'depositing' | 'complete'>('idle')
  const [showDirectDeposit, setShowDirectDeposit] = useState(false)
  const [currentChainId, setCurrentChainId] = useState<string | null>(null)
  const [startingChainId, setStartingChainId] = useState<string | null>(null) // Track where user started
  const lastUSDCBalanceRef = useRef<number | null>(null)
  
  // Progress tracking for better UX
  const [depositProgress, setDepositProgress] = useState<'idle' | 'checking' | 'approving' | 'requesting' | 'waiting_claim' | 'claiming' | 'success'>('idle')
  const [redeemProgress, setRedeemProgress] = useState<'idle' | 'requesting' | 'waiting_claim' | 'claiming' | 'success'>('idle')
  
  // Use useRef instead of useState to avoid closure issues in setInterval
  const isClaimingDepositRef = useRef(false)
  const isClaimingRedeemRef = useRef(false)

  // Contract addresses - dynamically configured based on vault deployment
  const USDC_SEPOLIA = CONTRACTS.usdc.sepolia
  const USDC_BASE_SEPOLIA = CONTRACTS.usdc.baseSepolia // Base Sepolia (best for Avail)
  const USDC_ARB_SEPOLIA = CONTRACTS.usdc.arbitrumSepolia
  const VAULT_ADDRESS = CONTRACTS.vault.address
  
  // Automatically select correct USDC address based on vault chain
  const getVaultChainUSDC = () => {
    switch(VAULT_CHAIN_ID) {
      case 11155111: return USDC_SEPOLIA      // Ethereum Sepolia
      case 421614: return USDC_ARB_SEPOLIA    // Arbitrum Sepolia
      case 84532: return USDC_BASE_SEPOLIA    // Base Sepolia
      default: return USDC_ARB_SEPOLIA        // Default to Arbitrum Sepolia
    }
  }
  
  const VAULT_USDC_ADDRESS = getVaultChainUSDC()

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(message)
  }

  // QuickNode RPC helper to bypass MetaMask caching
  // Dynamically select RPC based on vault's deployment chain
  const QUICKNODE_RPC = VAULT_CHAIN_ID === 421614 
    ? (process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || '')
    : VAULT_CHAIN_ID === 11155111
      ? (process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || '')
      : (process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || '') // Default fallback
  
  // Helper to get RPC URL for any chain
  const getRpcForChain = (chainId: string): string => {
    switch(chainId) {
      case '0xaa36a7': return process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || ''
      case '0x66eee': return process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || ''
      case '0x14a34': return process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || ''
      default: return QUICKNODE_RPC // Fallback to vault's RPC
    }
  }
  
  // Generic QuickNode fetch for eth_call
  const fetchViaQuickNode = async (data: string, to: string, chainId?: string) => {
    const rpcUrl = chainId ? getRpcForChain(chainId) : QUICKNODE_RPC
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
        id: 1
      })
    })
    const json = await response.json()
    return json.result
  }
  
  // Generic QuickNode fetch for any RPC method
  const fetchRpcViaQuickNode = async (method: string, params: any[], chainId?: string) => {
    const rpcUrl = chainId ? getRpcForChain(chainId) : QUICKNODE_RPC
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      })
    })
    const json = await response.json()
    return json.result
  }

  useEffect(() => {
    log('🚀 AsyncVault on Arbitrum Sepolia - Ready!')
    log('Make sure MetaMask is installed and you are on Arbitrum Sepolia')
    log('Get testnet USDC from: https://faucet.circle.com/ (or bridge from other chains)')
    setStatus('Ready to test')
  }, [])

  const connectWallet = async () => {
    try {
      log('🔌 Connecting to wallet...')
      setStatus('Connecting...')

      // Prefer MetaMask if multiple wallets are installed
      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
        log('🦊 Using MetaMask provider')
      }

      if (typeof provider === 'undefined') {
        throw new Error('MetaMask not installed!')
      }

      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      })
      
      const userAddress = accounts[0]
      setAddress(userAddress)
      setConnected(true)
      
      // Forward provider to Avail Nexus
      setProvider(provider)
      log('🔗 Provider forwarded to Avail Nexus')
      
      const chainId = await provider.request({ method: 'eth_chainId' })
      setCurrentChainId(chainId)
      setStartingChainId(chainId) // Remember where user started
      
      log(`✅ Connected: ${userAddress}`)
      log(`   Chain ID: ${chainId}`)
      log(`   🏠 Starting chain saved: ${chainId}`)
      
      if (chainId !== VAULT_CHAIN_HEX) {
        log(`⚠️ Warning: Not on ${VAULT_CHAIN_NAME}`)
        log(`   Current network: ${chainId}`)
        log('   This is OK for cross-chain deposits!')
        setStatus(`Connected to ${chainId}`)
      } else {
        log(`✅ Correct network: ${VAULT_CHAIN_NAME}`)
        setStatus(`Connected to ${VAULT_CHAIN_NAME}`)
      }
      
      // Listen for chain changes
      provider.on('chainChanged', (newChainId: string) => {
        log(`🔄 Chain changed to: ${newChainId}`)
        setCurrentChainId(newChainId)
      })
      
      // ✅ AUTO-LOAD vault balances after connecting (works regardless of current chain!)
      setTimeout(() => {
        checkVaultBalances()
      }, 500) // Small delay to ensure state is updated

    } catch (error: any) {
      log(`❌ Error: ${error.message}`)
      setStatus(`Connection failed: ${error.message}`)
    }
  }

  const approveUSDC = async () => {
    try {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('✅ APPROVING USDC FOR VAULT')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Approving USDC...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      // Approve max uint256 for unlimited spending
      const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      
      log('💰 Approving unlimited USDC for vault...')
      log('   (This is a one-time approval)')
      const approveTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDC_SEPOLIA,
          data: '0x095ea7b3' + // approve(address,uint256)
                VAULT_ADDRESS.slice(2).padStart(64, '0') + // vault address
                maxApproval.slice(2), // max amount
          gas: '0x' + (100000).toString(16)
        }]
      })
      
      log(`📤 Approval tx: ${approveTx}`)
      log('⏳ Waiting for confirmation...')
      await waitForTransaction(provider, approveTx)
      
      log('✅ USDC approved! You can now deposit without approval popups')
      setStatus('✅ USDC approved for vault')
    } catch (error: any) {
      log(`❌ Approval error: ${error.message}`)
      setStatus(`Approval failed: ${error.message}`)
    }
  }

  const revokeUSDC = async () => {
    try {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('🚫 REVOKING USDC APPROVAL')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Revoking USDC approval...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      // Approve 0 to revoke
      log('🔒 Setting approval to 0...')
      const revokeTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDC_SEPOLIA,
          data: '0x095ea7b3' + // approve(address,uint256)
                VAULT_ADDRESS.slice(2).padStart(64, '0') + // vault address
                '0000000000000000000000000000000000000000000000000000000000000000', // 0 amount
          gas: '0x' + (100000).toString(16)
        }]
      })
      
      log(`📤 Revoke tx: ${revokeTx}`)
      log('⏳ Waiting for confirmation...')
      await waitForTransaction(provider, revokeTx)
      
      log('✅ USDC approval revoked! Vault can no longer spend your USDC')
      setStatus('✅ USDC approval revoked')
    } catch (error: any) {
      log(`❌ Revoke error: ${error.message}`)
      setStatus(`Revoke failed: ${error.message}`)
    }
  }

  // Removed: approveUSDCForAvailBridge() - Not needed!
  // Avail Nexus widget handles approvals internally when nexus.bridge() is called

  const checkUSDC = async () => {
    try {
      log('💰 Checking USDC balance...')
      setStatus('Checking USDC...')

      if (!address) {
        throw new Error('No wallet address connected')
      }

      // Prefer MetaMask provider if multiple exist
      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      // Check current network and query USDC balance on THAT chain (not vault chain!)
      const chainId = await provider.request({ method: 'eth_chainId' })
      log(`Current chain ID: ${chainId}`)
      
      // ✅ Select correct USDC address based on CURRENT chain (not vault chain!)
      let usdcAddress: string
      let chainName: string
      switch(chainId) {
        case '0xaa36a7': // Ethereum Sepolia
          usdcAddress = USDC_SEPOLIA
          chainName = 'Ethereum Sepolia'
          break
        case '0x66eee': // Arbitrum Sepolia (421614)
          usdcAddress = USDC_ARB_SEPOLIA
          chainName = 'Arbitrum Sepolia'
          break
        case '0x14a34': // Base Sepolia (84532)
          usdcAddress = USDC_BASE_SEPOLIA
          chainName = 'Base Sepolia'
          break
        default:
          log(`⚠️ Unknown chain: ${chainId}, defaulting to Arbitrum Sepolia USDC`)
          usdcAddress = USDC_ARB_SEPOLIA
          chainName = 'Unknown Chain'
      }

      log(`Calling balanceOf for address: ${address}`)
      log(`USDC contract: ${usdcAddress} (${chainName})`)

      // ✅ USE QUICKNODE to avoid MetaMask caching issues!
      const balanceData = '0x70a08231000000000000000000000000' + address.slice(2)
      const balanceHex = await fetchViaQuickNode(balanceData, usdcAddress, chainId)

      log(`Raw balance hex: ${balanceHex}`)
      log(`Type: ${typeof balanceHex}, Value: ${balanceHex}`)
      
      if (!balanceHex || balanceHex === '0x') {
        throw new Error('Empty balance response from contract')
      }

      const balanceWei = parseInt(balanceHex, 16)
      log(`Balance in wei: ${balanceWei}`)
      
      const balance = balanceWei / 1e6
      log(`Balance after division: ${balance}`)
      
      if (isNaN(balance)) {
        throw new Error(`Invalid balance calculation: hex=${balanceHex}, parsed=${balanceWei}`)
      }

      setUsdcBalance(balance.toFixed(2))
      
      log(`✅ USDC Balance: ${balance.toFixed(2)}`)
      setStatus('Balance check complete')

    } catch (error: any) {
      log(`❌ Error: ${error.message}`)
      setStatus(`Balance check failed: ${error.message}`)
    }
  }

  const checkVaultBalances = async () => {
    try {
      log('🏦 Checking vault balances...')
      
      if (!address) {
        throw new Error('No wallet address connected')
      }

      // ✅ CRITICAL FIX: ALWAYS use QuickNode for vault data (works regardless of user's current chain!)
      // The vault is on Arbitrum Sepolia, but user might be on Ethereum Sepolia for bridging
      
      // Get shares balance - ALWAYS via QuickNode to vault's chain
      const sharesData = '0x70a08231000000000000000000000000' + address.slice(2) // balanceOf(address)
      const sharesHex = await fetchViaQuickNode(sharesData, VAULT_ADDRESS)
      const sharesWei = parseInt(sharesHex, 16)
      const shares = sharesWei / 1e6
      setVaultShares(shares.toFixed(6))
      log(`✅ Vault Shares: ${shares.toFixed(6)} ovUSDC`)

      // Check pending deposit - ALWAYS via QuickNode to vault's chain
      const pendingDepositData = '0xc3702989000000000000000000000000' + address.slice(2) // pendingDepositRequest(address)
      const pendingDepositHex = await fetchViaQuickNode(pendingDepositData, VAULT_ADDRESS)
      const pendingDepositWei = parseInt(pendingDepositHex, 16)
      const pendingDep = pendingDepositWei / 1e6
      setPendingDeposit(pendingDep > 0 ? pendingDep.toFixed(6) : '')
      if (pendingDep > 0) {
        log(`⏳ Pending Deposit: ${pendingDep.toFixed(6)} USDC`)
      } else {
        log(`✅ No pending deposit`)
      }

      // Check pending redeem - ALWAYS via QuickNode to vault's chain
      const pendingRedeemData = '0x53dc1dd3000000000000000000000000' + address.slice(2) // pendingRedeemRequest(address)
      const pendingRedeemHex = await fetchViaQuickNode(pendingRedeemData, VAULT_ADDRESS)
      const pendingRedeemWei = parseInt(pendingRedeemHex, 16)
      const pendingRed = pendingRedeemWei / 1e6
      setPendingRedeem(pendingRed > 0 ? pendingRed.toFixed(6) : '')
      if (pendingRed > 0) {
        log(`⏳ Pending Redeem: ${pendingRed.toFixed(6)} shares`)
      }

      // Check vault's total USDC balance - ALWAYS use QuickNode (critical for market bot updates)
      const vaultUSDCData = '0x70a08231000000000000000000000000' + VAULT_ADDRESS.slice(2) // balanceOf(VAULT_ADDRESS)
      const vaultUSDCHex = await fetchViaQuickNode(vaultUSDCData, VAULT_USDC_ADDRESS)
      const vaultUSDCWei = parseInt(vaultUSDCHex, 16)
      const vaultUSDC = vaultUSDCWei / 1e6
      setVaultUSDCBalance(vaultUSDC.toFixed(6))
      log(`💰 Vault Total USDC: ${vaultUSDC.toFixed(6)} USDC`)

      setStatus('Vault balances loaded')
    } catch (error: any) {
      log(`❌ Vault balance error: ${error.message}`)
    }
  }

  // Chain switching helper
  const switchToChain = async (chainId: string, chainName: string) => {
    try {
      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      log(`🔄 Switching to ${chainName}...`)
      setStatus(`Switching to ${chainName}...`)
      
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      })
      
      setCurrentChainId(chainId)
      log(`✅ Switched to ${chainName}`)
      setStatus(`✅ Switched to ${chainName}`)
      return true
    } catch (error: any) {
      if (error.code === 4902) {
        log(`⚠️ ${chainName} not added to MetaMask`)
        log(`   Please add this chain to MetaMask manually first`)
        setStatus(`❌ ${chainName} not in MetaMask - please add it first`)
        
        // Show helpful alert
        alert(`⚠️ Chain Not Found\n\n${chainName} is not added to your MetaMask.\n\nPlease add it manually:\n1. Go to chainlist.org\n2. Search for "${chainName}"\n3. Click "Add to MetaMask"\n4. Try switching again`)
      } else if (error.code === 4001) {
        log(`❌ User rejected chain switch`)
        setStatus('Chain switch cancelled')
      } else {
        log(`❌ Failed to switch: ${error.message}`)
        setStatus(`❌ Switch failed: ${error.message}`)
      }
      return false
    }
  }

  const getChainIdForSource = (source: string): string => {
    switch(source) {
      case 'arbitrum-sepolia': return VAULT_CHAIN_HEX  // 421614
      case 'base-sepolia': return '0x14a34'      // 84532
      case 'optimism-sepolia': return '0xaa37'   // 11155420
      case 'polygon-amoy': return '0x13882'      // 80002
      case 'sepolia': return '0xaa36a7'          // 11155111 (Ethereum Sepolia)
      default: return VAULT_CHAIN_HEX
    }
  }

  const getChainName = (source: string): string => {
    switch(source) {
      case 'arbitrum-sepolia': return 'Arbitrum Sepolia'
      case 'base-sepolia': return 'Base Sepolia'
      case 'optimism-sepolia': return 'Optimism Sepolia'
      case 'polygon-amoy': return 'Polygon Amoy'
      case 'sepolia': return 'Ethereum Sepolia'
      default: return source
    }
  }

  // Auto-trigger: Poll for balance increase and auto-deposit (Hybrid approach)
  const startAutoDepositPolling = () => {
    log('🤖 Auto-deposit mode: Polling for balance increase...')
    log('   Will auto-deposit when bridge completes (polling for 10 minutes)')
    
    let pollCount = 0
    const maxPolls = 120 // 10 minutes / 5 seconds = 120 polls (Avail bridges can take 5-10 mins on testnets)
    
    const pollInterval = setInterval(async () => {
      pollCount++
      
      // Don't check crossChainStep - continue polling even if state changes
      // This makes polling more robust during chain switches
      if (!address) {
        clearInterval(pollInterval)
        return
      }

      try {
        // Fetch current USDC balance via QuickNode (bypass cache)
        const balanceData = '0x70a08231000000000000000000000000' + address.slice(2)
        const balanceHex = await fetchViaQuickNode(balanceData, VAULT_USDC_ADDRESS)
        const currentBalance = parseInt(balanceHex, 16) / 1e6

        if (lastUSDCBalanceRef.current === null) {
          // First poll - store initial balance
          lastUSDCBalanceRef.current = currentBalance
          log(`   📊 Initial USDC balance: ${currentBalance.toFixed(6)} USDC`)
        } else {
          // Check if balance increased
          const increase = currentBalance - lastUSDCBalanceRef.current
          
          if (increase > 0.01) { // Threshold: at least 0.01 USDC increase
            log(`   ✅ Balance increased by ${increase.toFixed(6)} USDC!`)
            log(`   🚀 Auto-triggering vault deposit...`)
            clearInterval(pollInterval)
            
            setCrossChainStep('depositing')
            try {
              await depositToVault(crossChainAmount)
              setCrossChainStep('complete')
              log('🎉 Auto-deposit complete!')
              
              // Return user to their starting chain
              if (startingChainId && startingChainId !== VAULT_CHAIN_HEX) {
                const startChainName = getChainName(
                  startingChainId === VAULT_CHAIN_HEX ? 'arbitrum-sepolia' :
                  startingChainId === '0x14a34' ? 'base-sepolia' :
                  startingChainId === '0xaa37' ? 'optimism-sepolia' :
                  startingChainId === '0x13882' ? 'polygon-amoy' : 'sepolia'
                )
                log(`🏠 Returning to starting chain: ${startChainName}`)
                await switchToChain(startingChainId, startChainName)
              }
              
              setTimeout(() => {
                setCrossChainStep('idle')
                setCrossChainAmount('')
                lastUSDCBalanceRef.current = null
              }, 3000)
            } catch (err: any) {
              log(`❌ Auto-deposit error: ${err.message}`)
              setCrossChainStep('bridge_complete') // Fall back to manual
              lastUSDCBalanceRef.current = null
            }
          } else if (pollCount >= maxPolls) {
            // Timeout after 10 minutes - fall back to manual mode
            log('⏱️ Auto-deposit timeout (10 minutes) - falling back to manual mode')
            log('   Bridge may still be processing - click "Complete Deposit" when ready')
            clearInterval(pollInterval)
            setCrossChainStep('bridge_complete')
            setStatus('Bridge complete - click "Complete Deposit" to finish')
            lastUSDCBalanceRef.current = null
          } else if (pollCount % 6 === 0) {
            // Log progress every 30 seconds (6 polls * 5 seconds)
            const elapsed = Math.floor(pollCount * 5 / 60)
            const remaining = 10 - elapsed
            log(`   ⏳ Still polling... (${elapsed}m elapsed, ${remaining}m remaining)`)
            setStatus(`🌉 Waiting for bridge... ${elapsed}m/${10}m (Track: bridge.availproject.org/intents)`)
          }
        }
      } catch (err: any) {
        log(`⚠️ Polling error: ${err.message}`)
        // Don't stop polling on errors - bridge might still complete
      }
    }, 5000) // Poll every 5 seconds (36 times = 3 minutes)
  }

  const depositToVault = async (amount: string) => {
    try {
      setDepositProgress('checking')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('💰 STARTING VAULT DEPOSIT')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Checking approval...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      const amountWei = Math.floor(parseFloat(amount) * 1e6)
      const amountHex = amountWei.toString(16).padStart(64, '0')

      // Step 1: Check if approval is needed
      log('1️⃣ Checking USDC approval...')
      // CRITICAL: Use QuickNode to bypass MetaMask's aggressive caching
      const allowanceData = '0xdd62ed3e' + // allowance(address,address)
                            address.slice(2).padStart(64, '0') + // owner
                            VAULT_ADDRESS.slice(2).padStart(64, '0') // spender
      const allowanceHex = await fetchViaQuickNode(allowanceData, VAULT_USDC_ADDRESS)
      const currentAllowance = parseInt(allowanceHex, 16)
      log(`   Current allowance: ${(currentAllowance / 1e6).toFixed(2)} USDC`)

      if (currentAllowance < amountWei) {
        setDepositProgress('approving')
        log('⚠️  Insufficient approval - requesting approval...')
        log('💡 Tip: Use "Approve USDC" button above for one-time unlimited approval!')
        setStatus('Approving USDC...')
        
        // Approve max uint256 for unlimited spending (one-time approval)
        const maxApproval = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' // max uint256
        
        const approvalTx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: VAULT_USDC_ADDRESS, // ✅ FIX: Use dynamic USDC address for vault's chain
            data: '0x095ea7b3' + VAULT_ADDRESS.slice(2).padStart(64, '0') + maxApproval // approve(address,uint256) with max uint256
          }]
        })
        log(`✅ Approval tx: ${approvalTx}`)
        log('⏳ Waiting for confirmation...')
        setStatus('Waiting for approval confirmation...')
        await waitForTransaction(provider, approvalTx)
      } else {
        log('✅ Sufficient approval already exists - skipping approval step!')
      }
      
      // Step 2: Request deposit
      setDepositProgress('requesting')
      setStatus('Requesting deposit...')
      log('2️⃣ Requesting deposit...')
      const depositTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: VAULT_ADDRESS,
          data: '0x0d1e6667' + amountHex, // requestDeposit(uint256) - FIXED: use amountHex not amountWei
          gas: '0x' + (200000).toString(16) // Set explicit gas limit: 200k
        }]
      })
      log(`✅ Deposit request tx: ${depositTx}`)
      log('⏳ Waiting for confirmation...')
      setStatus('Waiting for deposit request confirmation...')
      await waitForTransaction(provider, depositTx)
      
      setDepositProgress('waiting_claim')
      log('✅ Deposit requested successfully!')
      log('')
      log('⚠️  NOTE: ERC-7540 requires 2-step flow:')
      log('   1. Request deposit (✅ done)')
      log('   2. Claim shares (⏳ next)')
      log('')
      
      // Clear input field
      const input = document.getElementById('depositAmount') as HTMLInputElement
      if (input) input.value = ''
      
      if (operatorBotEnabled) {
        log('🤖 Operator bot mode ENABLED - bot will auto-claim for you')
        log('   (No MetaMask popup needed for claim)')
        log('   Frontend will NOT attempt to claim (bot handles it)')
        setStatus('⏳ Waiting for bot to claim shares...')
        
        // Poll for completion (bot will claim in background)
        const pollInterval = setInterval(async () => {
          await checkVaultBalances()
          // Use QuickNode in bot mode for fresh data
          const depositData = '0xc3702989000000000000000000000000' + address.slice(2)
          const depositHex = operatorBotEnabled
            ? await fetchViaQuickNode(depositData, VAULT_ADDRESS)
            : await (window.ethereum as any).request({
                method: 'eth_call',
                params: [{ to: VAULT_ADDRESS, data: depositData }, 'latest']
              })
          const pendingDepositAssets = parseInt(depositHex, 16) / 1e6
          
          if (pendingDepositAssets === 0) {
            setDepositProgress('success')
            log('✅ Bot claimed successfully!')
            setStatus('✅ Deposit complete!')
            clearInterval(pollInterval)
            await checkUSDC()
            setTimeout(() => setDepositProgress('idle'), 3000)
          }
        }, 3000) // Poll every 3 seconds
        
        // Timeout after 60 seconds
        setTimeout(() => {
          clearInterval(pollInterval)
          if (depositProgress === 'waiting_claim') {
            setDepositProgress('idle')
            log('⚠️ Bot claim timeout - please check manually')
          }
        }, 60000)
        // DO NOT call pollAndClaimDeposit() - let the bot handle it!
      } else {
        setDepositProgress('claiming')
        log('👤 Self-claim mode - you will need to approve claim transaction')
        log('🔄 Starting auto-claim polling...')
        setStatus('⏳ Deposit pending - please approve CLAIM transaction when it appears')
        // Start polling for claim
        pollAndClaimDeposit()
      }

    } catch (error: any) {
      setDepositProgress('idle')
      log(`❌ Deposit error: ${error.message}`)
      setStatus(`Deposit failed: ${error.message}`)
    }
  }

  const pollAndClaimDeposit = async () => {
    const maxAttempts = 20 // Poll for ~1 minute
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      try {
        log(`🔍 Polling attempt ${attempts}/${maxAttempts}...`)
        
        let provider = window.ethereum
        if (window.ethereum?.providers) {
          provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
        }

        // Always use QuickNode for fresh data (self-claim mode still needs cache bypass)
        const pendingData = '0xc3702989000000000000000000000000' + address.slice(2)
        const pendingHex = await fetchViaQuickNode(pendingData, VAULT_ADDRESS)
        const pending = parseInt(pendingHex, 16) / 1e6

        // If no pending deposit, stop polling (already claimed by bot or self)
        if (pending === 0) {
          log('✅ Deposit already claimed (by bot or completed)')
          setDepositProgress('success')
          setStatus('✅ Deposit complete!')
          clearInterval(interval)
          await checkUSDC()
          await checkVaultBalances()
          setTimeout(() => setDepositProgress('idle'), 3000)
          return
        }

        if (pending > 0 && !isClaimingDepositRef.current) {
          isClaimingDepositRef.current = true // 🔒 Lock to prevent multiple claims
          log(`✅ Found pending deposit: ${pending.toFixed(6)} USDC`)
          log('🔒 Locking claim flag to prevent duplicate transactions')
          log('3️⃣ Claiming deposit...')
          
          try {
            const claimTx = await provider.request({
              method: 'eth_sendTransaction',
              params: [{
                from: address,
                to: VAULT_ADDRESS,
                data: '0x29d07a51', // claimDeposit() - NO PARAMETERS for user self-claim
                gas: '0x' + (150000).toString(16) // Set explicit gas limit: 150k
              }]
            })
            log(`✅ Claim tx: ${claimTx}`)
            await waitForTransaction(provider, claimTx)
            
            setDepositProgress('success')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            log('🎉 DEPOSIT COMPLETE! Shares minted!')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            setStatus('✅ Deposit complete!')
            clearInterval(interval)
            isClaimingDepositRef.current = false // 🔓 Unlock
            
            // Refresh balances
            await checkUSDC()
            await checkVaultBalances()
            
            // Reset progress after 3 seconds
            setTimeout(() => setDepositProgress('idle'), 3000)
          } catch (claimError: any) {
            log(`❌ Claim failed: ${claimError.message}`)
            isClaimingDepositRef.current = false // 🔓 Unlock on error
            
            // Check if user rejected the transaction
            if (claimError.message?.includes('User rejected') || claimError.code === 4001) {
              log('⚠️  User rejected claim transaction - you can try again')
              setStatus('Claim rejected - you can retry')
              setDepositProgress('idle')
              clearInterval(interval)
            }
            // Otherwise continue polling (might be a temporary error)
          }
        } else if (pending > 0 && isClaimingDepositRef.current) {
          log('⏳ Claim already in progress, skipping... (flag is locked)')
        }
      } catch (error: any) {
        log(`⚠️ Polling error: ${error.message}`)
        if (attempts >= maxAttempts) {
          log('⏱️ Polling timeout. Please try claiming manually.')
          setStatus('Polling timeout - manual claim may be needed')
          setDepositProgress('idle') // Reset UI state
          isClaimingDepositRef.current = false // Reset claim flag
          clearInterval(interval)
        }
      }
    }, 3000) // Poll every 3 seconds
  }

  const redeemFromVault = async (shares: string) => {
    try {
      setRedeemProgress('requesting')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('💸 STARTING VAULT REDEEM')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Requesting redeem...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      const sharesWei = Math.floor(parseFloat(shares) * 1e6).toString(16).padStart(64, '0')

      // Request redeem
      log('1️⃣ Requesting redeem...')
      const redeemTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: VAULT_ADDRESS,
          data: '0xaa2f892d' + sharesWei, // requestRedeem(uint256) - FIXED
          gas: '0x' + (150000).toString(16) // Set explicit gas limit: 150k
        }]
      })
      log(`✅ Redeem request tx: ${redeemTx}`)
      log('⏳ Waiting for confirmation...')
      setStatus('Waiting for redeem request confirmation...')
      await waitForTransaction(provider, redeemTx)
      
      setRedeemProgress('waiting_claim')
      log('✅ Redeem requested successfully!')
      log('')
      log('⚠️  NOTE: ERC-7540 requires 2-step flow:')
      log('   1. Request redeem (✅ done)')
      log('   2. Claim USDC (⏳ next)')
      log('')
      
      // Clear input field
      const input = document.getElementById('redeemAmount') as HTMLInputElement
      if (input) input.value = ''
      
      if (operatorBotEnabled) {
        log('🤖 Operator bot mode ENABLED - bot will auto-claim for you')
        log('   (No MetaMask popup needed for claim)')
        setStatus('⏳ Waiting for bot to claim USDC...')
        
        // Poll for completion (bot will claim in background)
        const pollInterval = setInterval(async () => {
          await checkVaultBalances()
          // Use QuickNode in bot mode for fresh data
          const redeemData = '0x53dc1dd3000000000000000000000000' + address.slice(2)
          const redeemHex = operatorBotEnabled
            ? await fetchViaQuickNode(redeemData, VAULT_ADDRESS)
            : await (window.ethereum as any).request({
                method: 'eth_call',
                params: [{ to: VAULT_ADDRESS, data: redeemData }, 'latest']
              })
          const pendingRedeemShares = parseInt(redeemHex, 16) / 1e6
          
          if (pendingRedeemShares === 0) {
            setRedeemProgress('success')
            log('✅ Bot claimed successfully!')
            setStatus('✅ Redeem complete!')
            clearInterval(pollInterval)
            await checkUSDC()
            setTimeout(() => setRedeemProgress('idle'), 3000)
          }
        }, 3000) // Poll every 3 seconds
        
        // Timeout after 60 seconds
        setTimeout(() => {
          clearInterval(pollInterval)
          if (redeemProgress === 'waiting_claim') {
            setRedeemProgress('idle')
            log('⚠️ Bot claim timeout - please check manually')
          }
        }, 60000)
      } else {
        setRedeemProgress('claiming')
        log('👤 Self-claim mode - you will need to approve claim transaction')
        log('🔄 Starting auto-claim polling...')
        setStatus('⏳ Redeem pending - please approve CLAIM transaction when it appears')
        // Start polling for claim
        pollAndClaimRedeem()
      }

    } catch (error: any) {
      setRedeemProgress('idle')
      log(`❌ Redeem error: ${error.message}`)
      setStatus(`Redeem failed: ${error.message}`)
    }
  }

  const pollAndClaimRedeem = async () => {
    const maxAttempts = 20
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      try {
        log(`🔍 Polling attempt ${attempts}/${maxAttempts}...`)
        
        let provider = window.ethereum
        if (window.ethereum?.providers) {
          provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
        }

        // Always use QuickNode for fresh data (self-claim mode still needs cache bypass)
        const pendingData = '0x53dc1dd3000000000000000000000000' + address.slice(2)
        const pendingHex = await fetchViaQuickNode(pendingData, VAULT_ADDRESS)
        const pending = parseInt(pendingHex, 16) / 1e6

        // If no pending redeem, stop polling (already claimed by bot or self)
        if (pending === 0) {
          log('✅ Redeem already claimed (by bot or completed)')
          setRedeemProgress('success')
          setStatus('✅ Redeem complete!')
          clearInterval(interval)
          await checkUSDC()
          await checkVaultBalances()
          setTimeout(() => setRedeemProgress('idle'), 3000)
          return
        }

        if (pending > 0 && !isClaimingRedeemRef.current) {
          isClaimingRedeemRef.current = true // 🔒 Lock to prevent multiple claims
          log(`✅ Found pending redeem: ${pending.toFixed(6)} shares`)
          log('🔒 Locking claim flag to prevent duplicate transactions')
          log('2️⃣ Claiming redeem...')
          
          try {
            const claimTx = await provider.request({
              method: 'eth_sendTransaction',
              params: [{
                from: address,
                to: VAULT_ADDRESS,
                data: '0x29df8703', // claimRedeem() - NO PARAMETERS for user self-claim
                gas: '0x' + (150000).toString(16) // Set explicit gas limit: 150k
              }]
            })
            log(`✅ Claim tx: ${claimTx}`)
            await waitForTransaction(provider, claimTx)
            
            setRedeemProgress('success')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            log('🎉 REDEEM COMPLETE! USDC returned!')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            setStatus('✅ Redeem complete!')
            clearInterval(interval)
            isClaimingRedeemRef.current = false // 🔓 Unlock
            
            // Refresh balances
            await checkUSDC()
            await checkVaultBalances()
            
            // Reset progress after 3 seconds
            setTimeout(() => setRedeemProgress('idle'), 3000)
          } catch (claimError: any) {
            log(`❌ Claim failed: ${claimError.message}`)
            isClaimingRedeemRef.current = false // 🔓 Unlock on error
            
            // Check if user rejected the transaction
            if (claimError.message?.includes('User rejected') || claimError.code === 4001) {
              log('⚠️  User rejected claim transaction - you can try again')
              setStatus('Claim rejected - you can retry')
              setRedeemProgress('idle')
              clearInterval(interval)
            }
            // Otherwise continue polling (might be a temporary error)
          }
        } else if (pending > 0 && isClaimingRedeemRef.current) {
          log('⏳ Claim already in progress, skipping... (flag is locked)')
        }
      } catch (error: any) {
        log(`⚠️ Polling error: ${error.message}`)
        if (attempts >= maxAttempts) {
          log('⏱️ Polling timeout. Please try claiming manually.')
          setStatus('Polling timeout - manual claim may be needed')
          setRedeemProgress('idle') // Reset UI state
          isClaimingRedeemRef.current = false // Reset claim flag
          clearInterval(interval)
        }
      }
    }, 3000)
  }

  const waitForTransaction = async (provider: any, txHash: string) => {
    let confirmed = false
    let attempts = 0
    const maxAttempts = 60 // Wait up to 3 minutes
    
    while (!confirmed && attempts < maxAttempts) {
      try {
        // ✅ USE QUICKNODE to avoid MetaMask caching and for more reliable polling
        // All vault transactions are on the vault's chain (Arbitrum Sepolia)
        const receipt = await fetchRpcViaQuickNode('eth_getTransactionReceipt', [txHash])
        
        if (receipt && receipt.status) {
          confirmed = true
          log(`✅ Transaction confirmed in block ${parseInt(receipt.blockNumber, 16)}`)
        } else {
          await new Promise(resolve => setTimeout(resolve, 3000))
          attempts++
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        attempts++
      }
    }
    
    if (!confirmed) {
      throw new Error('Transaction confirmation timeout')
    }
  }


  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">🏦 OmniVault - Cross-Chain DeFi Vault</h1>
        <p className="text-gray-600 mb-6">
          Bridge USDC across chains with Avail Nexus, then deposit into our ERC-7540 vault for yield! ✨
        </p>
        
        <div className={`p-4 rounded mb-6 ${
          status.includes('failed') ? 'bg-red-100 text-red-800' :
          status.includes('complete') || status.includes('Ready') ? 'bg-green-100 text-green-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          <strong>Status:</strong> {status}
        </div>

        <div className="space-y-6">
          {/* Step 1: Connect Wallet */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 1: Connect Wallet</h2>
            <button
              onClick={connectWallet}
              disabled={connected}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {connected ? '✅ Connected' : 'Connect Wallet'}
            </button>
            {connected && (
              <div className="mt-4 p-4 bg-green-50 rounded">
                <p className="font-mono text-sm break-all">
                  <strong>Address:</strong> {address}
                </p>
              </div>
            )}
          </div>

          {/* Operator Bot Toggle */}
          {connected && (
            <div className="border rounded-lg p-6 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">🤖 Operator Bot Mode</h2>
                  <p className="text-sm text-gray-600 mb-2">
                    {operatorBotEnabled 
                      ? 'Bot will automatically claim deposits/redeems (no MetaMask popups)'
                      : 'You will approve each claim transaction in MetaMask'}
                  </p>
                  <p className="text-xs text-gray-500 italic">
                    Note: Bot mode applies to all users. In production, this would be per-user preference.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOperatorBotEnabled(!operatorBotEnabled)
                    log(operatorBotEnabled 
                      ? '👤 Switched to SELF-CLAIM mode (you approve each claim)'
                      : '🤖 Switched to OPERATOR BOT mode (bot auto-claims)')
                  }}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    operatorBotEnabled
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  {operatorBotEnabled ? '✅ Bot Enabled' : '⭕ Bot Disabled'}
                </button>
              </div>
              {operatorBotEnabled && (
                <div className="mt-4 p-3 bg-purple-100 border-l-4 border-purple-500 rounded text-sm">
                  <p className="font-semibold text-purple-900 mb-1">Note:</p>
                  <p className="text-purple-800">
                    Make sure the operator bot is running: <code className="bg-purple-200 px-2 py-1 rounded">cd operator-bot && npm start</code>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bot Control Section */}
          {connected && (
            <div className="border rounded-lg p-6 bg-gradient-to-r from-green-50 to-teal-50">
              <h2 className="text-xl font-semibold mb-4">🎮 Bot Control Center</h2>
              <p className="text-sm text-gray-600 mb-4">
                Start/stop bots for automated claiming and market simulation.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Operator Bot Control */}
                <div className="p-4 bg-white rounded-lg border">
                  <h3 className="font-semibold mb-2">🤖 Operator Bot</h3>
                  <p className="text-xs text-gray-600 mb-3">Auto-claims deposits/redeems for users</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/operator-bot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'start' })
                          })
                          const data = await res.json()
                          log(`✅ Operator bot: ${data.message}`)
                        } catch (error: any) {
                          log(`❌ Operator bot error: ${error.message}`)
                        }
                      }}
                      className="flex-1 bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
                    >
                      ▶️ Start
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/operator-bot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'stop' })
                          })
                          const data = await res.json()
                          log(`⏸️ Operator bot: ${data.message}`)
                        } catch (error: any) {
                          log(`❌ Operator bot error: ${error.message}`)
                        }
                      }}
                      className="flex-1 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600"
                    >
                      ⏸️ Stop
                    </button>
                  </div>
                </div>

                {/* Market Simulator Control */}
                <div className="p-4 bg-white rounded-lg border">
                  <h3 className="font-semibold mb-2">📊 Market Simulator</h3>
                  <p className="text-xs text-gray-600 mb-3">Geometric Brownian Motion with exponential timing</p>
                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    <p>• Target APY: 10%</p>
                    <p>• Avg Interval: 15 min</p>
                    <p>• Volatility: 80%</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/market-simulator', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'start' })
                          })
                          const data = await res.json()
                          log(`✅ Market simulator: ${data.message}`)
                        } catch (error: any) {
                          log(`❌ Market simulator error: ${error.message}`)
                        }
                      }}
                      className="flex-1 bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
                    >
                      ▶️ Start
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/market-simulator', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'stop' })
                          })
                          const data = await res.json()
                          log(`⏸️ Market simulator: ${data.message}`)
                        } catch (error: any) {
                          log(`❌ Market simulator error: ${error.message}`)
                        }
                      }}
                      className="flex-1 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600"
                    >
                      ⏸️ Stop
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/market-simulator', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'trigger' })
                          })
                          const data = await res.json()
                          log(`🎲 Market event triggered manually`)
                        } catch (error: any) {
                          log(`❌ Market simulator error: ${error.message}`)
                        }
                      }}
                      className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-xs">
                <p className="font-semibold text-yellow-900">💡 Note:</p>
                <p className="text-yellow-800">
                  • Operator bot: Automatically claims deposits/redeems (replaces manual claiming)<br />
                  • Market simulator: Transfers real USDC to/from vault to simulate price changes<br />
                  • 🎲 = Trigger one market event immediately (for testing)
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Check USDC & Switch Chain */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Check USDC Balance & Switch Chain</h2>
            
            {/* Manual Chain Switcher */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2 text-sm">🔄 Manual Chain Switcher</h3>
              <p className="text-xs text-gray-600 mb-3">Switch to any Avail-supported chain</p>
              <div className="flex gap-2">
                <select
                  id="manualChainSelect"
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  defaultValue="base-sepolia"
                >
                  <option value="base-sepolia">Base Sepolia (Most Common)</option>
                  <option value="optimism-sepolia">Optimism Sepolia</option>
                  <option value="sepolia">Ethereum Sepolia</option>
                  <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
                  <option value="polygon-amoy">Polygon Amoy</option>
                </select>
                <button
                  onClick={async () => {
                    const select = document.getElementById('manualChainSelect') as HTMLSelectElement
                    const targetChain = select.value as any
                    const chainId = getChainIdForSource(targetChain)
                    const chainName = getChainName(targetChain)
                    await switchToChain(chainId, chainName)
                  }}
                  disabled={!connected}
                  className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
                >
                  Switch
                </button>
              </div>
              {currentChainId && (
                <p className="text-xs text-gray-600 mt-2">
                  Currently on: <span className="font-semibold">{
                    currentChainId === VAULT_CHAIN_HEX ? VAULT_CHAIN_NAME :
                    currentChainId === '0xaa36a7' ? 'Ethereum Sepolia' :
                    currentChainId === '0x14a34' ? 'Base Sepolia' :
                    currentChainId === '0xaa37' ? 'Optimism Sepolia' :
                    currentChainId === '0x13882' ? 'Polygon Amoy' :
                    currentChainId
                  }</span>
                </p>
              )}
              <p className="text-xs text-amber-600 mt-2">
                💡 If switch fails: Add chain via <a href="https://chainlist.org" target="_blank" className="underline font-semibold">chainlist.org</a>
              </p>
            </div>
            
            <button
              onClick={checkUSDC}
              disabled={!connected}
              className="w-full bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Check USDC
            </button>
            {usdcBalance && (
              <div className="mt-4 space-y-3">
                <div className="p-4 bg-green-50 rounded">
                  <p className="text-2xl font-bold">{usdcBalance} USDC</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Contract: <span className="font-mono text-xs">{VAULT_USDC_ADDRESS}</span> ({VAULT_CHAIN_NAME})
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
                    🪙 Get testnet USDC: <a href="https://faucet.circle.com/" target="_blank" rel="noopener" className="underline">faucet.circle.com</a>
                  </p>
                </div>
                
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <p className="font-semibold text-yellow-900 mb-2">💡 One-Click Deposits</p>
                  <p className="text-sm text-yellow-800 mb-3">
                    Approve USDC once, then deposits require only 1 MetaMask popup!
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={approveUSDC}
                      className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 font-semibold text-sm"
                    >
                      ✅ Approve USDC (Vault)
                    </button>
                    <button
                      onClick={revokeUSDC}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-semibold text-sm"
                    >
                      🚫 Revoke Approval
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 You can revoke approval anytime for security
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                  <p className="font-semibold text-blue-900 mb-2">ℹ️  About Avail Nexus Approvals</p>
                  <p className="text-sm text-blue-800 mb-2">
                    No pre-approval needed! The Avail Nexus widget will automatically prompt for USDC approval when you bridge.
                  </p>
                  <p className="text-xs text-gray-600">
                    💡 Avail Nexus uses a decentralized solver network - the widget handles all approvals internally
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Manual Chain Switcher */}
          <div className="border rounded-lg p-6 bg-gradient-to-br from-green-50 to-blue-50">
            <h2 className="text-xl font-semibold mb-4">Step 4: Vault Operations 🏦</h2>
            <p className="text-sm text-gray-600 mb-4">
              Deposit USDC into the vault to earn yield, or redeem your shares back to USDC!
            </p>

            {connected ? (
              <div className="space-y-6">
                {/* Balances */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-600">Your USDC</p>
                    <p className="text-2xl font-bold text-blue-600">{usdcBalance}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-600">Your Shares</p>
                    <p className="text-2xl font-bold text-green-600">{vaultShares || '0.000000'}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-600">💰 Vault Total USDC</p>
                    <p className="text-2xl font-bold text-purple-600">{vaultUSDCBalance || '0.000000'}</p>
                  </div>
                </div>

                {/* Check Vault Button */}
                <button
                  onClick={checkVaultBalances}
                  className="w-full bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                >
                  🔄 Refresh Vault Balances
                </button>

                {/* Cross-Chain Deposit Section (Primary) */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-lg border-2 border-purple-200">
                  <h3 className="font-semibold mb-2 text-lg">🌍 Cross-Chain Deposit (Recommended)</h3>
                  <p className="text-xs text-gray-600 mb-4">Deposit USDC from ANY chain using Avail Nexus</p>
                  
                  <div className="space-y-3">
                    {/* Source Chain Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Source Chain</label>
                      <select
                        value={sourceChain}
                        onChange={(e) => setSourceChain(e.target.value as any)}
                        className="w-full border rounded px-3 py-2 bg-white"
                        disabled={crossChainStep !== 'idle'}
                      >
                        <option value="sepolia">Ethereum Sepolia (Most Stable ✅)</option>
                        <option value="arbitrum-sepolia">Arbitrum Sepolia (Same chain, direct deposit)</option>
                        <option value="base-sepolia">Base Sepolia</option>
                        <option value="optimism-sepolia">Optimism Sepolia</option>
                        <option value="polygon-amoy">Polygon Amoy Testnet</option>
                      </select>
                    </div>
                    
                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USDC)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="0.1"
                        value={crossChainAmount}
                        onChange={(e) => setCrossChainAmount(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        disabled={crossChainStep !== 'idle'}
                      />
                    </div>
                    
                    {/* Step 0: Switch to source chain if needed */}
                    {sourceChain !== 'arbitrum-sepolia' && crossChainStep === 'idle' && currentChainId !== getChainIdForSource(sourceChain) && (
                      <button
                        onClick={async () => {
                          const targetChainId = getChainIdForSource(sourceChain)
                          const targetChainName = getChainName(sourceChain)
                          const success = await switchToChain(targetChainId, targetChainName)
                          if (success) {
                            log(`✅ Ready to bridge from ${targetChainName}`)
                            // Don't change crossChainStep - stay in 'idle' so bridge button appears
                          }
                        }}
                        disabled={!crossChainAmount || parseFloat(crossChainAmount) <= 0}
                        className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
                      >
                        🔄 Step 1: Switch to {getChainName(sourceChain)}
                      </button>
                    )}
                    
                    {/* Step 1: Bridge from source chain (ALWAYS show if different from vault chain AND on correct chain) */}
                    {/* ✅ FIX: During bridging, ignore chain checks - Avail widget handles chain switching internally! */}
                    {(() => {
                      const isOnSourceChain = currentChainId === getChainIdForSource(sourceChain)
                      const isDifferentFromVault = getChainIdForSource(sourceChain) !== VAULT_CHAIN_HEX
                      
                      // While bridging, keep button mounted regardless of current chain (Avail switches chains internally)
                      const shouldShow = crossChainStep === 'bridging' 
                        ? isDifferentFromVault  // During bridging: only check it's a cross-chain operation
                        : (crossChainStep === 'idle' && isOnSourceChain && isDifferentFromVault)  // While idle: check we're on correct chain
                      
                      console.log('🔍 BridgeButton render check:', {
                        crossChainStep,
                        currentChainId,
                        sourceChain,
                        sourceChainId: getChainIdForSource(sourceChain),
                        vaultChainHex: VAULT_CHAIN_HEX,
                        isOnSourceChain,
                        isDifferentFromVault,
                        shouldShow
                      })
                      return shouldShow
                    })() && (
                      <BridgeButton
                        key={`bridge-${sourceChain}-${crossChainAmount || '0.1'}`} // ✅ Force remount when amount changes
                        prefill={{
                          fromChainId: sourceChain === 'sepolia' ? 11155111 :
                                      sourceChain === 'arbitrum-sepolia' ? 421614 : 
                                      sourceChain === 'base-sepolia' ? 84532 :
                                      sourceChain === 'optimism-sepolia' ? 11155420 :
                                      sourceChain === 'polygon-amoy' ? 80002 : 11155111,
                          toChainId: VAULT_CHAIN_ID, // ✅ Dynamic: wherever the vault is deployed
                          token: 'USDC',
                          amount: crossChainAmount || '0.1'
                        } as any}
                      >
                        {({ onClick, isLoading }) => (
                            <button
                              onClick={async () => {
                                // Validation
                                if (!crossChainAmount || parseFloat(crossChainAmount) <= 0) {
                                  log('⚠️ Please enter a valid amount')
                                  setStatus('Please enter amount first')
                                  return
                                }
                                
                                setCrossChainStep('bridging')
                                try {
                                  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                                  log('🌍 CROSS-CHAIN DEPOSIT - STEP 1: BRIDGE')
                                  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                                  const sourceChainName = sourceChain === 'arbitrum-sepolia' ? VAULT_CHAIN_NAME :
                                                         sourceChain === 'sepolia' ? 'Ethereum Sepolia' :
                                                         sourceChain === 'base-sepolia' ? 'Base Sepolia' :
                                                         sourceChain === 'optimism-sepolia' ? 'Optimism Sepolia' :
                                                         sourceChain === 'polygon-amoy' ? 'Polygon Amoy' : sourceChain
                                  log(`   Bridge: ${sourceChainName} → ${VAULT_CHAIN_NAME} (where vault is)`)
                                  log(`   Amount: ${crossChainAmount} USDC`)
                                  log('📊 Track live: https://bridge.availproject.org/intents')
                                  log(`   Your address: ${address}`)
                                  setStatus('Opening Avail bridge...')
                                  
                                  log('🔍 DEBUG: Calling onClick()...')
                                  log(`🔍 DEBUG: onClick type: ${typeof onClick}`)
                                  log(`🔍 DEBUG: isLoading: ${isLoading}`)
                                  const result = await onClick()
                                  log(`🔍 DEBUG: onClick returned: ${JSON.stringify(result)}`)
                                  
                                  log('✅ Widget opened - complete the bridge transaction')
                                  if (operatorBotEnabled) {
                                    log('🤖 Bot will auto-deposit after bridge completes (polling 10 min)')
                                    setStatus('Complete bridge - bot will auto-deposit')
                                    startAutoDepositPolling()
                                  } else {
                                    log('⏳ Complete bridge, then click "Complete Deposit"')
                                    setStatus('Complete bridge, then click button below')
                                    setCrossChainStep('bridge_complete')
                                  }
                                } catch (err: any) {
                                  log(`❌ Bridge error: ${err.message}`)
                                  setStatus(`Bridge failed: ${err.message}`)
                                  setCrossChainStep('idle')
                                }
                              }}
                              disabled={isLoading || crossChainStep === 'bridging' || !crossChainAmount || parseFloat(crossChainAmount) <= 0}
                              className="w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
                            >
                              {crossChainStep === 'bridging' ? '⏳ Complete bridge in widget...' :
                               isLoading ? '⏳ Loading Bridge...' : operatorBotEnabled 
                                ? `🤖 Bridge + Auto-Deposit from ${sourceChain === 'arbitrum-sepolia' ? 'Arbitrum Sep.' : 
                                                                     sourceChain === 'base-sepolia' ? 'Base Sep.' :
                                                                     sourceChain === 'optimism-sepolia' ? 'Optimism Sep.' :
                                                                     sourceChain === 'polygon-amoy' ? 'Polygon Amoy' : sourceChain}`
                                : `🌉 Step 1: Bridge from ${sourceChain === 'arbitrum-sepolia' ? 'Arbitrum Sep.' :
                                                            sourceChain === 'base-sepolia' ? 'Base Sep.' :
                                                            sourceChain === 'optimism-sepolia' ? 'Optimism Sep.' :
                                                            sourceChain === 'polygon-amoy' ? 'Polygon Amoy' : sourceChain}`
                              }
                            </button>
                        )}
                      </BridgeButton>
                    )}
                    
                    {/* Step 2: Deposit to vault (after bridge complete OR for same-chain deposit) */}
                    {/* ALWAYS show button for full control - works in both bot and manual mode */}
                    {/* Show if: bridging, bridge complete, OR source chain is same as vault chain */}
                    {(crossChainStep === 'bridge_complete' || crossChainStep === 'bridging' || getChainIdForSource(sourceChain) === VAULT_CHAIN_HEX) && crossChainStep !== 'depositing' && crossChainStep !== 'complete' && (
                      <button
                        onClick={async () => {
                          setCrossChainStep('depositing')
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          log('🌍 CROSS-CHAIN DEPOSIT - STEP 2: VAULT DEPOSIT')
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          try {
                            // Ensure we're on Arbitrum Sepolia for vault deposit
                            if (currentChainId !== VAULT_CHAIN_HEX) {
                              log('🔄 Switching back to Arbitrum Sepolia for vault deposit...')
                              await switchToChain(VAULT_CHAIN_HEX, VAULT_CHAIN_NAME)
                            }
                            
                            await depositToVault(crossChainAmount)
                            setCrossChainStep('complete')
                            log('✅ Cross-chain deposit complete!')
                            
                            // Return user to their starting chain
                            if (startingChainId && startingChainId !== VAULT_CHAIN_HEX) {
                              const startChainName = getChainName(
                                startingChainId === VAULT_CHAIN_HEX ? 'arbitrum-sepolia' :
                                startingChainId === '0x14a34' ? 'base-sepolia' :
                                startingChainId === '0xaa37' ? 'optimism-sepolia' :
                                startingChainId === '0x13882' ? 'polygon-amoy' : 'sepolia'
                              )
                              log(`🏠 Returning to starting chain: ${startChainName}`)
                              await switchToChain(startingChainId, startChainName)
                            }
                            
                            setTimeout(() => {
                              setCrossChainStep('idle')
                              setCrossChainAmount('')
                            }, 3000)
                          } catch (err: any) {
                            log(`❌ Vault deposit error: ${err.message}`)
                            setCrossChainStep(sourceChain === 'sepolia' ? 'idle' : 'bridge_complete')
                          }
                        }}
                        disabled={!crossChainAmount || parseFloat(crossChainAmount) <= 0}
                        className="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg"
                      >
                        {getChainIdForSource(sourceChain) === VAULT_CHAIN_HEX
                          ? '💰 Deposit to Vault' 
                          : operatorBotEnabled && crossChainStep === 'bridging'
                            ? '🤖 Manual Override: Complete Deposit Now'
                            : '✅ Step 2: Complete Deposit to Vault'}
                      </button>
                    )}
                    
                    {/* Progress feedback */}
                    {crossChainStep !== 'idle' && (
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
                        <p className="font-semibold text-blue-900">
                          {crossChainStep === 'bridging' && operatorBotEnabled && '🤖 Bridge widget opened - polling for completion...'}
                          {crossChainStep === 'bridging' && !operatorBotEnabled && '🌉 Opening Avail bridge widget...'}
                          {crossChainStep === 'bridge_complete' && '✅ Bridge initiated! Click "Complete Deposit" below'}
                          {crossChainStep === 'depositing' && operatorBotEnabled && '🤖 Auto-depositing to vault...'}
                          {crossChainStep === 'depositing' && !operatorBotEnabled && '⏳ Depositing to vault...'}
                          {crossChainStep === 'complete' && '🎉 Cross-chain deposit complete!'}
                        </p>
                      </div>
                    )}
                    
                    {/* Avail failure fallback message */}
                    {crossChainStep === 'bridge_complete' && !operatorBotEnabled && (
                      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm">
                        <p className="font-semibold text-yellow-800">💡 If bridge failed:</p>
                        <p className="text-xs text-gray-700 mt-1">
                          No problem! Use the "Show Direct Deposit" option below to deposit USDC that's already on Arbitrum Sepolia.
                        </p>
                      </div>
                    )}
                    
                    {/* Reset button */}
                    {crossChainStep !== 'idle' && crossChainStep !== 'complete' && (
                      <button
                        onClick={() => {
                          setCrossChainStep('idle')
                          lastUSDCBalanceRef.current = null
                          log('🔄 Cross-chain deposit flow reset')
                        }}
                        className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
                      >
                        ❌ Cancel / Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct Deposit Section (Fallback - Collapsible) */}
                <div className="border-t pt-4">
                  <button
                    onClick={() => setShowDirectDeposit(!showDirectDeposit)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showDirectDeposit ? '▼' : '▶'} Show Direct Deposit (Arbitrum Sepolia only)
                  </button>
                </div>

                {showDirectDeposit && (
                  <div className="p-4 bg-white rounded-lg shadow">
                    <h3 className="font-semibold mb-3">⚡ Direct Deposit (Arbitrum Sepolia USDC)</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Amount (USDC)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="1.0"
                        id="depositAmount"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const input = document.getElementById('depositAmount') as HTMLInputElement
                        if (input && input.value) {
                          depositToVault(input.value)
                        }
                      }}
                      disabled={depositProgress !== 'idle' || (!!pendingDeposit && parseFloat(pendingDeposit) > 0)}
                      className="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                    >
                      {depositProgress === 'idle' && '💰 Deposit to Vault'}
                      {depositProgress === 'checking' && '🔍 Checking Approval...'}
                      {depositProgress === 'approving' && '⏳ Approving USDC...'}
                      {depositProgress === 'requesting' && '⏳ Requesting Deposit...'}
                      {depositProgress === 'waiting_claim' && '⏳ Waiting for Claim...'}
                      {depositProgress === 'claiming' && '⏳ Claiming Shares...'}
                      {depositProgress === 'success' && '✅ Deposit Complete!'}
                    </button>
                    
                    {/* Reset button for stuck states */}
                    {depositProgress !== 'idle' && depositProgress !== 'success' && (
                      <button
                        onClick={() => {
                          setDepositProgress('idle')
                          setStatus('Deposit cancelled')
                          log('🔄 Deposit flow reset by user')
                        }}
                        className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
                      >
                        ❌ Cancel / Reset
                      </button>
                    )}
                    
                    {depositProgress !== 'idle' && (
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
                        <p className="font-semibold text-blue-900">
                          {depositProgress === 'checking' && '1/3: Checking approval...'}
                          {depositProgress === 'approving' && '1/3: Approving USDC...'}
                          {depositProgress === 'requesting' && '2/3: Requesting deposit...'}
                          {depositProgress === 'waiting_claim' && `3/3: ${operatorBotEnabled ? 'Bot will claim automatically' : 'Waiting for your claim approval'}`}
                          {depositProgress === 'claiming' && `3/3: ${operatorBotEnabled ? 'Bot claiming shares...' : 'Approve claim in MetaMask'}`}
                          {depositProgress === 'success' && '✅ Deposit complete! Shares minted.'}
                        </p>
                      </div>
                    )}
                    {pendingDeposit && parseFloat(pendingDeposit) > 0 ? (
                      <p className="text-xs text-amber-600 font-semibold">
                        ⚠️ Cannot deposit: You have a pending deposit of {pendingDeposit} USDC waiting to be claimed
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Note: This will approve USDC, request deposit, and auto-claim shares
                      </p>
                    )}
                  </div>
                </div>
                )}

                {/* Redeem Section */}
                <div className="p-4 bg-white rounded-lg shadow">
                  <h3 className="font-semibold mb-3">💸 Redeem Shares</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Shares to Redeem</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="1.0"
                        id="redeemAmount"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const input = document.getElementById('redeemAmount') as HTMLInputElement
                        if (input && input.value) {
                          log(`🔍 Redeem button clicked with input value: ${input.value}`)
                          redeemFromVault(input.value)
                        } else {
                          log(`⚠️  Redeem button clicked but no value entered`)
                          setStatus('Please enter an amount to redeem')
                        }
                      }}
                      disabled={!vaultShares || parseFloat(vaultShares) === 0 || redeemProgress !== 'idle' || (!!pendingRedeem && parseFloat(pendingRedeem) > 0)}
                      className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
                    >
                      {redeemProgress === 'idle' && '💸 Redeem from Vault'}
                      {redeemProgress === 'requesting' && '⏳ Requesting Redeem...'}
                      {redeemProgress === 'waiting_claim' && '⏳ Waiting for Claim...'}
                      {redeemProgress === 'claiming' && '⏳ Claiming USDC...'}
                      {redeemProgress === 'success' && '✅ Redeem Complete!'}
                    </button>
                    
                    {/* Reset button for stuck states */}
                    {redeemProgress !== 'idle' && redeemProgress !== 'success' && (
                      <button
                        onClick={() => {
                          setRedeemProgress('idle')
                          setStatus('Redeem cancelled')
                          log('🔄 Redeem flow reset by user')
                        }}
                        className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
                      >
                        ❌ Cancel / Reset
                      </button>
                    )}
                    
                    {redeemProgress !== 'idle' && (
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
                        <p className="font-semibold text-blue-900">
                          {redeemProgress === 'requesting' && '1/2: Requesting redeem...'}
                          {redeemProgress === 'waiting_claim' && `2/2: ${operatorBotEnabled ? 'Bot will claim automatically' : 'Waiting for your claim approval'}`}
                          {redeemProgress === 'claiming' && `2/2: ${operatorBotEnabled ? 'Bot claiming USDC...' : 'Approve claim in MetaMask'}`}
                          {redeemProgress === 'success' && '✅ Redeem complete! USDC returned.'}
                        </p>
                      </div>
                    )}
                    {pendingRedeem && parseFloat(pendingRedeem) > 0 ? (
                      <p className="text-xs text-amber-600 font-semibold">
                        ⚠️ Cannot redeem: You have a pending redeem of {pendingRedeem} shares waiting to be claimed
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Note: This will request redeem and auto-claim USDC
                      </p>
                    )}
                  </div>
                </div>

                {/* Pending Requests */}
                {(pendingDeposit || pendingRedeem) && (
                  <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="font-semibold text-yellow-800 mb-2">⏳ Pending Requests:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {pendingDeposit && <li>Deposit: {pendingDeposit} USDC waiting to be claimed</li>}
                      {pendingRedeem && <li>Redeem: {pendingRedeem} shares waiting to be claimed</li>}
                    </ul>
                  </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-blue-50 rounded text-sm">
                  <p className="font-semibold mb-2">ℹ️ How It Works:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li><strong>Deposit:</strong> USDC → Approve → Request → Auto-claim → Get asUSDC shares</li>
                    <li><strong>Redeem:</strong> Burn shares → Request → Auto-claim → Get USDC back</li>
                    <li><strong>Auto-claiming:</strong> {operatorBotEnabled ? '🤖 Operator bot claims automatically (no MetaMask popups)' : '👤 Frontend polls every 3 seconds and submits claim tx'}</li>
                    <li><strong>1:1 Pricing:</strong> 1 USDC = 1 asUSDC (initially)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic">
                Connect wallet and check USDC balance first
              </p>
            )}
          </div>

          {/* Logs */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Test Log</h2>
            <div className="bg-gray-50 p-4 rounded font-mono text-xs max-h-[600px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded">
          <h3 className="font-semibold mb-2">🎯 Next Steps:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Install Avail Nexus: <code className="bg-white px-2 py-1 rounded">npm install @availproject/nexus-widgets</code></li>
            <li>Import BridgeWidget component</li>
            <li>Test cross-chain PYUSD bridge</li>
            <li>Connect to vault contracts</li>
          </ol>
        </div>
      </div>
    </main>
  )
}

declare global {
  interface Window {
    ethereum?: any
  }
}

