'use client'

import { useState, useEffect } from 'react'
import { BridgeButton, useNexus } from '@avail-project/nexus-widgets'

export default function Home() {
  const { setProvider } = useNexus()
  const [status, setStatus] = useState('Initializing...')
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [usdcBalance, setUsdcBalance] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'in_progress' | 'success' | 'failed'>('idle')
  const [logs, setLogs] = useState<string[]>([])

  // USDC addresses from Avail Discord (official Circle deployments)
  const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  const USDC_ARB_SEPOLIA = '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d'

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


  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">🧪 Cross-Chain USDC Bridge Test</h1>
        
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
                  }}
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

          {/* Logs */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Test Log</h2>
            <div className="bg-gray-50 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
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

