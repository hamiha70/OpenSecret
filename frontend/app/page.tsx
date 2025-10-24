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
  const [pendingDeposit, setPendingDeposit] = useState('')
  const [pendingRedeem, setPendingRedeem] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'in_progress' | 'success' | 'failed'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  
  // Use useRef instead of useState to avoid closure issues in setInterval
  const isClaimingDepositRef = useRef(false)
  const isClaimingRedeemRef = useRef(false)

  // Contract addresses
  const USDC_SEPOLIA = CONTRACTS.usdc.sepolia
  const USDC_ARB_SEPOLIA = CONTRACTS.usdc.arbitrumSepolia
  const VAULT_ADDRESS = CONTRACTS.vault.address

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

      // Check vault shares (balanceOf)
      const sharesHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: VAULT_ADDRESS,
          data: '0x70a08231000000000000000000000000' + address.slice(2) // balanceOf(address)
        }, 'latest']
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
          data: '0xc3702989000000000000000000000000' + address.slice(2) // pendingDepositRequest(address) - FIXED
        }, 'latest']
      })
      const pendingDepositWei = parseInt(pendingDepositHex, 16)
      const pendingDep = pendingDepositWei / 1e6
      setPendingDeposit(pendingDep > 0 ? pendingDep.toFixed(6) : '')
      if (pendingDep > 0) {
        log(`⏳ Pending Deposit: ${pendingDep.toFixed(6)} USDC`)
      }

      // Check pending redeem
      const pendingRedeemHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: VAULT_ADDRESS,
          data: '0x53dc1dd3000000000000000000000000' + address.slice(2) // pendingRedeemRequest(address) - FIXED
        }, 'latest']
      })
      const pendingRedeemWei = parseInt(pendingRedeemHex, 16)
      const pendingRed = pendingRedeemWei / 1e6
      setPendingRedeem(pendingRed > 0 ? pendingRed.toFixed(6) : '')
      if (pendingRed > 0) {
        log(`⏳ Pending Redeem: ${pendingRed.toFixed(6)} shares`)
      }

      setStatus('Vault balances loaded')
    } catch (error: any) {
      log(`❌ Vault balance error: ${error.message}`)
    }
  }

  const depositToVault = async (amount: string) => {
    try {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('💰 STARTING VAULT DEPOSIT')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Depositing to vault...')

      let provider = window.ethereum
      if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum
      }

      const amountWei = Math.floor(parseFloat(amount) * 1e6).toString(16).padStart(64, '0')

      // Step 1: Approve USDC
      log('1️⃣ Approving USDC...')
      const approvalTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDC_SEPOLIA,
          data: '0x095ea7b3' + VAULT_ADDRESS.slice(2).padStart(64, '0') + amountWei // approve(address,uint256)
        }]
      })
      log(`✅ Approval tx: ${approvalTx}`)
      log('⏳ Waiting for confirmation...')
      await waitForTransaction(provider, approvalTx)
      
      // Step 2: Request deposit
      log('2️⃣ Requesting deposit...')
      const depositTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: VAULT_ADDRESS,
          data: '0x0d1e6667' + amountWei, // requestDeposit(uint256) - FIXED SELECTOR
          gas: '0x' + (200000).toString(16) // Set explicit gas limit: 200k
        }]
      })
      log(`✅ Deposit request tx: ${depositTx}`)
      log('⏳ Waiting for confirmation...')
      await waitForTransaction(provider, depositTx)
      
      log('✅ Deposit requested successfully!')
      log('')
      log('⚠️  NOTE: ERC-7540 requires 2-step flow:')
      log('   1. Request deposit (✅ done)')
      log('   2. Claim shares (⏳ next - you will need to approve this)')
      log('')
      log('🔄 Starting auto-claim polling...')
      setStatus('⏳ Deposit pending - please approve CLAIM transaction when it appears')
      
      // Start polling for claim
      pollAndClaimDeposit()

    } catch (error: any) {
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

        const pendingHex = await provider.request({
          method: 'eth_call',
          params: [{
            to: VAULT_ADDRESS,
            data: '0xc3702989000000000000000000000000' + address.slice(2) // FIXED SELECTOR
          }, 'latest']
        })
        const pending = parseInt(pendingHex, 16) / 1e6

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
                data: '0xde56603c000000000000000000000000' + address.slice(2), // claimDeposit(address) - FIXED
                gas: '0x' + (150000).toString(16) // Set explicit gas limit: 150k
              }]
            })
            log(`✅ Claim tx: ${claimTx}`)
            await waitForTransaction(provider, claimTx)
            
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            log('🎉 DEPOSIT COMPLETE! Shares minted!')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            setStatus('Deposit complete!')
            clearInterval(interval)
            isClaimingDepositRef.current = false // 🔓 Unlock
            
            // Refresh balances
            await checkUSDC()
            await checkVaultBalances()
          } catch (claimError: any) {
            log(`❌ Claim failed: ${claimError.message}`)
            isClaimingDepositRef.current = false // 🔓 Unlock on error
            throw claimError
          }
        } else if (pending > 0 && isClaimingDepositRef.current) {
          log('⏳ Claim already in progress, skipping... (flag is locked)')
        }
      } catch (error: any) {
        log(`⚠️ Polling error: ${error.message}`)
        if (attempts >= maxAttempts) {
          log('⏱️ Polling timeout. Please try claiming manually.')
          setStatus('Polling timeout - manual claim may be needed')
          clearInterval(interval)
        }
      }
    }, 3000) // Poll every 3 seconds
  }

  const redeemFromVault = async (shares: string) => {
    try {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('💸 STARTING VAULT REDEEM')
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setStatus('Redeeming from vault...')

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
      await waitForTransaction(provider, redeemTx)
      
      log('✅ Redeem requested successfully!')
      log('')
      log('⚠️  NOTE: ERC-7540 requires 2-step flow:')
      log('   1. Request redeem (✅ done)')
      log('   2. Claim USDC (⏳ next - you will need to approve this)')
      log('')
      log('🔄 Starting auto-claim polling...')
      setStatus('⏳ Redeem pending - please approve CLAIM transaction when it appears')
      
      // Start polling for claim
      pollAndClaimRedeem()

    } catch (error: any) {
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

        const pendingHex = await provider.request({
          method: 'eth_call',
          params: [{
            to: VAULT_ADDRESS,
            data: '0x53dc1dd3000000000000000000000000' + address.slice(2) // FIXED SELECTOR
          }, 'latest']
        })
        const pending = parseInt(pendingHex, 16) / 1e6

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
                data: '0x0c5cb572000000000000000000000000' + address.slice(2), // claimRedeem(address) - FIXED
                gas: '0x' + (150000).toString(16) // Set explicit gas limit: 150k
              }]
            })
            log(`✅ Claim tx: ${claimTx}`)
            await waitForTransaction(provider, claimTx)
            
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            log('🎉 REDEEM COMPLETE! USDC returned!')
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            setStatus('Redeem complete!')
            clearInterval(interval)
            isClaimingRedeemRef.current = false // 🔓 Unlock
            
            // Refresh balances
            await checkUSDC()
            await checkVaultBalances()
          } catch (claimError: any) {
            log(`❌ Claim failed: ${claimError.message}`)
            isClaimingRedeemRef.current = false // 🔓 Unlock on error
            throw claimError
          }
        } else if (pending > 0 && isClaimingRedeemRef.current) {
          log('⏳ Claim already in progress, skipping... (flag is locked)')
        }
      } catch (error: any) {
        log(`⚠️ Polling error: ${error.message}`)
        if (attempts >= maxAttempts) {
          log('⏱️ Polling timeout. Please try claiming manually.')
          setStatus('Polling timeout - manual claim may be needed')
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
              <div className="mt-4 p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold">{usdcBalance} USDC</p>
                <p className="text-sm text-gray-600 mt-2">
                  Contract: <span className="font-mono text-xs">{USDC_SEPOLIA}</span>
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  🪙 Get testnet USDC: <a href="https://faucet.circle.com/" target="_blank" rel="noopener" className="underline">faucet.circle.com</a>
                </p>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-600">USDC Balance</p>
                    <p className="text-2xl font-bold text-blue-600">{usdcBalance}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-600">Vault Shares</p>
                    <p className="text-2xl font-bold text-green-600">{vaultShares || '0.000000'}</p>
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
                      className="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-semibold"
                    >
                      💰 Deposit to Vault
                    </button>
                    <p className="text-xs text-gray-500">
                      Note: This will approve USDC, request deposit, and auto-claim shares
                    </p>
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
                          redeemFromVault(input.value)
                        }
                      }}
                      disabled={!vaultShares || parseFloat(vaultShares) === 0}
                      className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
                    >
                      💸 Redeem from Vault
                    </button>
                    <p className="text-xs text-gray-500">
                      Note: This will request redeem and auto-claim USDC
                    </p>
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
                    <li><strong>Deposit:</strong> USDC → Approve → Request → Auto-claim → Get ovUSDC shares</li>
                    <li><strong>Redeem:</strong> Burn shares → Request → Auto-claim → Get USDC back</li>
                    <li><strong>Auto-claiming:</strong> Frontend polls every 3 seconds and claims for you</li>
                    <li><strong>1:1 Pricing:</strong> 1 USDC = 1 ovUSDC (for MVP)</li>
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

