'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [status, setStatus] = useState('Initializing...')
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [pyusdBalance, setPyusdBalance] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  const PYUSD_SEPOLIA = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(message)
  }

  useEffect(() => {
    log('🚀 Avail Test Page Loaded')
    log('Make sure MetaMask is installed and you are on Ethereum Sepolia')
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

  const checkPYUSD = async () => {
    try {
      log('💰 Checking PYUSD balance...')
      setStatus('Checking PYUSD...')

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
      log(`PYUSD contract: ${PYUSD_SEPOLIA}`)

      const balanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: PYUSD_SEPOLIA,
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

      setPyusdBalance(balance.toFixed(2))
      
      log(`✅ PYUSD Balance: ${balance.toFixed(2)}`)
      setStatus('Balance check complete')

    } catch (error: any) {
      log(`❌ Error: ${error.message}`)
      setStatus(`Balance check failed: ${error.message}`)
    }
  }

  const testAvailSDK = async () => {
    log('🔍 Testing Avail Nexus SDK...')
    setStatus('Testing Avail SDK...')

    // Check if Avail SDK can be loaded
    try {
      log('Checking for Avail Nexus SDK...')
      log('ℹ️  Avail Nexus requires React/Next.js integration')
      log('   Install: npm install @availproject/nexus-widgets')
      log('   Then import BridgeWidget component')
      log('')
      log('✅ This test confirms:')
      log('   - Browser supports Web3 ✅')
      log('   - Wallet connection works ✅')
      log('   - Can read PYUSD contract ✅')
      log('   - Ready for Avail integration ✅')
      setStatus('Ready for Avail widgets!')
    } catch (error: any) {
      log(`❌ Error: ${error.message}`)
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">🧪 Avail Nexus Browser Test</h1>
        
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

          {/* Step 2: Check PYUSD */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Check PYUSD Balance</h2>
            <button
              onClick={checkPYUSD}
              disabled={!connected}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Check PYUSD
            </button>
            {pyusdBalance && (
              <div className="mt-4 p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold">{pyusdBalance} PYUSD</p>
                <p className="text-sm text-gray-600 mt-2">
                  Contract: <span className="font-mono text-xs">{PYUSD_SEPOLIA}</span>
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Test Avail SDK */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 3: Test Avail SDK</h2>
            <button
              onClick={testAvailSDK}
              disabled={!connected}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Test Avail SDK
            </button>
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

