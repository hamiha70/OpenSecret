'use client'

import { NexusProvider } from '@avail-project/nexus-widgets'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NexusProvider
      config={{
        debug: true, // Enable debug logs for testing
        network: 'testnet', // Use testnet for Sepolia/Arbitrum Sepolia
      }}
    >
      {children}
    </NexusProvider>
  )
}

