'use client'

import { useState, useEffect, useRef } from 'react'
import { BridgeButton, useNexus } from '@avail-project/nexus-widgets'
import { CONTRACTS } from '../config/contracts'
import AsyncVaultABI from '../config/AsyncVault.abi.json'

export default function Home() {
  const { setProvider } = useNexus()
  const [status, setStatus] = useState('Initializing...')
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [usdcBalance, setUsdcBalance] = useState('')
  const [vaultShares, setVaultShares] = useState('')
  const [vaultUSDCBalance, setVaultUSDCBalance] = useState('') // Total USDC in vault
  const [lastRefresh, setLastRefresh] = useState<number>(0) // Timestamp to force re-renders
  const [pendingDeposit, setPendingDeposit] = useState('')
  const [pendingRedeem, setPendingRedeem] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'in_progress' | 'success' | 'failed'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [operatorBotEnabled, setOperatorBotEnabled] = useState(false)
  
  // Progress tracking for better UX
  const [depositProgress, setDepositProgress] = useState<'idle' | 'checking' | 'approving' | 'requesting' | 'waiting_claim' | 'claiming' | 'success'>('idle')
  const [redeemProgress, setRedeemProgress] = useState<'idle' | 'requesting' | 'waiting_claim' | 'claiming' | 'success'>('idle')
  
  // Use useRef instead of useState to avoid closure issues in setInterval
  const isClaimingDepositRef = useRef(false)
  const isClaimingRedeemRef = useRef(false)

  // Contract addresses
  const USDC_SEPOLIA = CONTRACTS.usdc.sepolia
  const USDC_BASE_SEPOLIA = CONTRACTS.usdc.baseSepolia // Base Sepolia (best for Avail)
  const USDC_ARB_SEPOLIA = CONTRACTS.usdc.arbitrumSepolia
  const VAULT_ADDRESS = CONTRACTS.vault.address
  const AVAIL_BRIDGE_ADDRESS = '0x0000000000000000000000000000000000000000' // TODO: Update in Phase 3

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(message)
  }

  useEffect(() => {
    log('🚀 Avail Nexus + USDC Test Page Loaded')
    log('Make sure MetaMask is installed and you are on Ethereum Sepolia')
    log('Get testnet USDC from: https://faucet.circle.com/')
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
      
      log(`✅ Connected: ${userAddress}`)
      log(`   Chain ID: ${chainId}`)
      
      if (chainId !== '0xaa36a7') {
        log('⚠️ Warning: Not on Sepolia')
        log(`   Current network: ${chainId === '0x1' ? 'Ethereum Mainnet' : chainId}`)
        log('   Will auto-switch when you check PYUSD')
        setStatus('Connected - Please switch to Sepolia')
      } else {
        log('✅ Correct network: Sepolia')
        setStatus('Connected to Sepolia')
      }

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

  const approveUSDCForAvailBridge = async () => {
    try {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('🌉 APPROVING USDC FOR AVAIL BRIDGE')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Approving USDC for Avail Bridge...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      // Check current chain
      const chainId = await provider.request({ method: 'eth_chainId' })
      log(`Current chain: ${chainId}`)

      // Switch to Base Sepolia if needed
      if (chainId !== '0x14a34') { // Base Sepolia chain ID (84532 = 0x14a34)
        log('⚠️  Not on Base Sepolia - switching networks...')
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }],
          })
          log('✅ Switched to Base Sepolia successfully!')
        } catch (switchError: any) {
          log(`❌ Failed to switch: ${switchError.message}`)
          throw new Error(`Wrong network! Please switch to Base Sepolia in MetaMask`)
        }
      }

      // Approve max uint256 for unlimited spending
      const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      
      log('💰 Approving unlimited USDC for Avail bridge on Base Sepolia...')
      log('   (This is a one-time approval for cross-chain bridging)')
      log('⚠️  Note: Avail bridge address is placeholder - will be updated in Phase 3')
      
      const approveTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDC_BASE_SEPOLIA,
          data: '0x095ea7b3' + // approve(address,uint256)
                AVAIL_BRIDGE_ADDRESS.slice(2).padStart(64, '0') + // bridge address (TODO: update)
                maxApproval.slice(2), // max amount
          gas: '0x' + (100000).toString(16)
        }]
      })
      
      log(`📤 Approval tx on Base Sepolia: ${approveTx}`)
      log('⏳ Waiting for confirmation...')
      await waitForTransaction(provider, approveTx)
      
      log('✅ USDC approved for Avail bridge! You can now bridge from Base → Sepolia')
      log('💡 Switching back to Ethereum Sepolia for vault operations...')
      
      // Switch back to Sepolia
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia
        })
        log('✅ Switched back to Ethereum Sepolia')
      } catch (switchError: any) {
        log('⚠️  Please manually switch back to Ethereum Sepolia')
      }
      
      setStatus('✅ USDC approved for Avail bridge')
    } catch (error: any) {
      log(`❌ Avail bridge approval error: ${error.message}`)
      setStatus(`Avail bridge approval failed: ${error.message}`)
    }
  }

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

      // Check current network
      const chainId = await provider.request({ method: 'eth_chainId' })
      log(`Current chain ID: ${chainId}`)
      
      if (chainId !== '0xaa36a7') {
        log(`Wrong network detected: ${chainId}`)
        log('Requesting network switch to Sepolia...')
        
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          })
          log('✅ Switched to Sepolia successfully!')
          log('Please click "Check PYUSD" again')
          setStatus('Switched to Sepolia - try again')
          return
        } catch (switchError: any) {
          log(`❌ Failed to switch: ${switchError.message}`)
          throw new Error(`Wrong network! You're on ${chainId === '0x1' ? 'Mainnet' : chainId}. Please manually switch to Sepolia in MetaMask`)
        }
      }

      log(`Calling balanceOf for address: ${address}`)
      log(`USDC contract: ${USDC_SEPOLIA}`)

      const balanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: USDC_SEPOLIA,
          data: '0x70a08231000000000000000000000000' + address.slice(2)
        }, 'latest']
      })

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

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      // Force fresh data by ALWAYS using 'latest' tag instead of block numbers
      // This ensures we bypass any client-side or RPC-level caching
      const LATEST_BLOCK = 'latest'
      
      // Get shares balance
      const sharesHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: VAULT_ADDRESS,
          data: '0x70a08231000000000000000000000000' + address.slice(2) // balanceOf(address)
        }, LATEST_BLOCK]
      })
      const sharesWei = parseInt(sharesHex, 16)
      const shares = sharesWei / 1e6
      setVaultShares(shares.toFixed(6))
      log(`✅ Vault Shares: ${shares.toFixed(6)} ovUSDC`)

      // Check pending deposit
      const pendingDepositHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: VAULT_ADDRESS,
          data: '0xc3702989000000000000000000000000' + address.slice(2) // pendingDepositRequest(address)
        }, LATEST_BLOCK]
      })
      const pendingDepositWei = parseInt(pendingDepositHex, 16)
      const pendingDep = pendingDepositWei / 1e6
      setPendingDeposit(pendingDep > 0 ? pendingDep.toFixed(6) : '')
      if (pendingDep > 0) {
        log(`⏳ Pending Deposit: ${pendingDep.toFixed(6)} USDC`)
      } else {
        log(`✅ No pending deposit`)
      }

      // Check pending redeem
      const pendingRedeemHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: VAULT_ADDRESS,
          data: '0x53dc1dd3000000000000000000000000' + address.slice(2) // pendingRedeemRequest(address)
        }, LATEST_BLOCK]
      })
      const pendingRedeemWei = parseInt(pendingRedeemHex, 16)
      const pendingRed = pendingRedeemWei / 1e6
      setPendingRedeem(pendingRed > 0 ? pendingRed.toFixed(6) : '')
      if (pendingRed > 0) {
        log(`⏳ Pending Redeem: ${pendingRed.toFixed(6)} shares`)
      }

      // Check vault's total USDC balance
      const vaultUSDCHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: USDC_SEPOLIA,
          data: '0x70a08231000000000000000000000000' + VAULT_ADDRESS.slice(2) // balanceOf(VAULT_ADDRESS)
        }, LATEST_BLOCK]
      })
      const vaultUSDCWei = parseInt(vaultUSDCHex, 16)
      const vaultUSDC = vaultUSDCWei / 1e6
      setVaultUSDCBalance(vaultUSDC.toFixed(6))
      log(`💰 Vault Total USDC: ${vaultUSDC.toFixed(6)} USDC`)

      // Update refresh timestamp to force UI re-render even if values didn't change
      setLastRefresh(Date.now())
      setStatus('Vault balances loaded')
    } catch (error: any) {
      log(`❌ Vault balance error: ${error.message}`)
    }
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
      const allowanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: USDC_SEPOLIA,
          data: '0xdd62ed3e' + // allowance(address,address)
                address.slice(2).padStart(64, '0') + // owner
                VAULT_ADDRESS.slice(2).padStart(64, '0') // spender
        }, 'latest']
      })
      const currentAllowance = parseInt(allowanceHex, 16)
      log(`   Current allowance: ${(currentAllowance / 1e6).toFixed(2)} USDC`)

      if (currentAllowance < amountWei) {
        setDepositProgress('approving')
        log('⚠️  Insufficient approval - requesting approval...')
        log('💡 Tip: Use "Approve USDC" button above for one-time unlimited approval!')
        setStatus('Approving USDC...')
        
        const approvalTx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: USDC_SEPOLIA,
            data: '0x095ea7b3' + VAULT_ADDRESS.slice(2).padStart(64, '0') + amountHex // approve(address,uint256)
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
          const depositHex = await (window.ethereum as any).request({
            method: 'eth_call',
            params: [{
              to: VAULT_ADDRESS,
              data: '0xc3702989000000000000000000000000' + address.slice(2) // pendingDepositRequest(address)
            }, 'latest']
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

        // Force fresh data by using 'latest' tag (cache-busting)
        const pendingHex = await provider.request({
          method: 'eth_call',
          params: [{
            to: VAULT_ADDRESS,
            data: '0xc3702989000000000000000000000000' + address.slice(2) // pendingDepositRequest
          }, 'latest']
        })
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
          const redeemHex = await (window.ethereum as any).request({
            method: 'eth_call',
            params: [{
              to: VAULT_ADDRESS,
              data: '0xaed27577000000000000000000000000' + address.slice(2) // pendingRedeemRequest(address)
            }, 'latest']
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

        // Force fresh data by using 'latest' tag (cache-busting)
        const pendingHex = await provider.request({
          method: 'eth_call',
          params: [{
            to: VAULT_ADDRESS,
            data: '0x53dc1dd3000000000000000000000000' + address.slice(2) // pendingRedeemRequest
          }, 'latest']
        })
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
        const receipt = await provider.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash]
        })
        
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

          {/* Step 2: Check USDC */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Check USDC Balance</h2>
            <button
              onClick={checkUSDC}
              disabled={!connected}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Check USDC
            </button>
            {usdcBalance && (
              <div className="mt-4 space-y-3">
                <div className="p-4 bg-green-50 rounded">
                  <p className="text-2xl font-bold">{usdcBalance} USDC</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Contract: <span className="font-mono text-xs">{USDC_SEPOLIA}</span>
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
                  <p className="font-semibold text-blue-900 mb-2">🌉 Cross-Chain Bridge (Avail Nexus)</p>
                  <p className="text-sm text-blue-800 mb-3">
                    Approve USDC on Base Sepolia for automatic bridging to Sepolia!
                  </p>
                  <button
                    onClick={approveUSDCForAvailBridge}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-semibold text-sm"
                  >
                    🌉 Approve USDC (Avail Bridge)
                  </button>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 This switches to Base Sepolia, approves USDC for the Avail bridge, then switches back
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️  Coming in Phase 3 - bridge address is placeholder for now
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Avail Bridge */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 3: Bridge with Avail Nexus</h2>
            <p className="text-sm text-gray-600 mb-4">
              Click the button below to open Avail Nexus bridge and transfer USDC across chains!
            </p>
            
            {connected && usdcBalance ? (
              <div className="space-y-4">
                <BridgeButton
                  prefill={{
                    fromChainId: 11155111, // Sepolia
                    toChainId: 421614, // Arbitrum Sepolia (corrected chain ID)
                    token: 'USDC', // USDC is officially supported!
                    amount: '0.1' // Start with small test amount
                  } as any}
                >
                  {({ onClick, isLoading }) => (
                    <button
                      onClick={async () => {
                        setBridgeStatus('in_progress')
                        try {
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          log('🌉 STARTING AVAIL BRIDGE TRANSACTION')
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          log('📊 Bridge Config:')
                          log('   • From: Sepolia (11155111)')
                          log('   • To: Arbitrum Sepolia (421614)')
                          log('   • Token: USDC (officially supported)')
                          log('   • Amount: 0.1 USDC')
                          log('   • Total USDC: ' + usdcBalance + ' available')
                          log('')
                          log('🔄 Opening Avail Nexus widget...')
                          setStatus('Opening Avail bridge...')
                          
                          await onClick()
                          
                          log('✅ Bridge widget opened successfully!')
                          log('📝 Next steps in widget:')
                          log('   1. ✅ Sign message to enable Nexus')
                          log('   2. ⏳ Approve USDC token allowance')
                          log('   3. ⏳ Set spending cap')
                          log('   4. ⏳ Confirm bridge transaction')
                          log('')
                          log('⏳ Waiting for user actions in MetaMask...')
                          log('   • Watch MetaMask for popups!')
                          log('   • Do not cancel transactions')
                          log('   • Each step needs approval')
                          setStatus('Waiting for MetaMask approvals...')
                          
                          // Note: We can't detect completion here as the onClick doesn't return transaction status
                          // The bridge continues in the background through the Nexus widget
                        } catch (err: any) {
                          setBridgeStatus('failed')
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          log(`❌ BRIDGE ERROR: ${err.message}`)
                          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                          if (err.stack) {
                            log(`Stack: ${err.stack}`)
                          }
                          setStatus(`Bridge failed: ${err.message}`)
                        }
                      }}
                      disabled={isLoading}
                      className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
                    >
                      {isLoading ? '⏳ Loading Bridge...' : '🌉 Bridge USDC with Avail Nexus'}
                    </button>
                  )}
                </BridgeButton>
                
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded text-sm">
                    <p className="font-semibold mb-2">💡 Bridge Tips:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      <li>Current USDC balance: {usdcBalance} on Sepolia</li>
                      <li>Test amount: 0.1 USDC (you can change this)</li>
                      <li>Destination: Arbitrum Sepolia (chain ID 421614)</li>
                      <li>✅ USDC is officially supported by Avail (PYUSD is not)</li>
                      <li>Avail Nexus aggregates liquidity across chains</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm">
                    <p className="font-semibold text-yellow-800 mb-2">⚠️ Known UI Quirks:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      <li><strong>MetaMask may show "Ethereum Mainnet"</strong> during sign-in - this is cosmetic, you're actually on Sepolia</li>
                      <li><strong>Transaction steps:</strong> Sign-in → Token Allowance → Spending Cap → Bridge TX</li>
                      <li><strong>Do NOT cancel</strong> any MetaMask popups during the flow</li>
                      <li><strong>If cancelled:</strong> Just click the bridge button again and complete all steps</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic">
                Connect wallet and check USDC balance first
              </p>
            )}
          </div>

          {/* Step 4: Vault Operations */}
          <div className="border rounded-lg p-6 bg-gradient-to-br from-green-50 to-blue-50">
            <h2 className="text-xl font-semibold mb-4">Step 4: Vault Operations 🏦</h2>
            <p className="text-sm text-gray-600 mb-4">
              Deposit USDC into the vault to earn yield, or redeem your shares back to USDC!
            </p>

            {connected && usdcBalance ? (
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
                    <p className="text-2xl font-bold text-purple-600" key={lastRefresh}>
                      {vaultUSDCBalance || '0.000000'}
                    </p>
                    {lastRefresh > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(lastRefresh).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Check Vault Button */}
                <button
                  onClick={checkVaultBalances}
                  className="w-full bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                >
                  🔄 Refresh Vault Balances
                </button>

                {/* Deposit Section */}
                <div className="p-4 bg-white rounded-lg shadow">
                  <h3 className="font-semibold mb-3">💰 Deposit USDC</h3>
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

