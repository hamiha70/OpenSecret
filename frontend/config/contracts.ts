/**
 * Contract addresses and configuration
 */

// Validate required environment variable (FAIL FAST)
if (!process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS) {
  throw new Error(
    'NEXT_PUBLIC_ASYNCVAULT_ADDRESS is not set in .env\n' +
    'Please add: NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x...'
  )
}

export const CONTRACTS = {
  // AsyncVault deployed on Arbitrum Sepolia (ERC4626 + Centrifuge pattern + operator)
  vault: {
    address: process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS as `0x${string}`,
    chainId: 421614, // Arbitrum Sepolia
  },
  
  // USDC on multiple testnets (Circle's official deployments)
  usdc: {
    sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
    baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const, // Base Sepolia (best for Avail)
    arbitrumSepolia: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d' as const,
  },
  
  // Operator address (can claim deposits/redeems on behalf of users)
  operator: '0x36AB88fDd34848C0caF4599736a9D3a860D051Ba' as const,
} as const;

export const CHAIN_IDS = {
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532, // Base Sepolia - most stable for Avail Nexus
  ARBITRUM_SEPOLIA: 421614,
} as const;

export const CHAIN_NAMES = {
  [CHAIN_IDS.SEPOLIA]: 'Ethereum Sepolia',
  [CHAIN_IDS.BASE_SEPOLIA]: 'Base Sepolia',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'Arbitrum Sepolia',
} as const;

export const RPC_URLS = {
  [CHAIN_IDS.SEPOLIA]: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
  [CHAIN_IDS.BASE_SEPOLIA]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
} as const;

export const BLOCK_EXPLORERS = {
  [CHAIN_IDS.SEPOLIA]: 'https://eth-sepolia.blockscout.com',
  [CHAIN_IDS.BASE_SEPOLIA]: 'https://base-sepolia.blockscout.com',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'https://arbitrum-sepolia.blockscout.com', // Using Blockscout for consistency
} as const;

// Avail Nexus Bridge Address (placeholder - will be determined in Phase 3)
export const AVAIL_BRIDGE_ADDRESS = '0x0000000000000000000000000000000000000000' as const; // TODO: Update with actual Avail bridge address

