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
  // AsyncVault deployed on Ethereum Sepolia (ERC4626 + Centrifuge pattern + operator)
  vault: {
    address: process.env.NEXT_PUBLIC_ASYNCVAULT_ADDRESS as `0x${string}`,
    chainId: 11155111, // Sepolia
  },
  
  // USDC on Ethereum Sepolia (Circle's official deployment)
  usdc: {
    sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
    arbitrumSepolia: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d' as const,
  },
  
  // Operator address (can claim deposits/redeems on behalf of users)
  operator: '0x36AB88fDd34848C0caF4599736a9D3a860D051Ba' as const,
} as const;

export const CHAIN_IDS = {
  SEPOLIA: 11155111,
  ARBITRUM_SEPOLIA: 421614,
} as const;

export const CHAIN_NAMES = {
  [CHAIN_IDS.SEPOLIA]: 'Ethereum Sepolia',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'Arbitrum Sepolia',
} as const;

export const RPC_URLS = {
  [CHAIN_IDS.SEPOLIA]: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
} as const;

export const BLOCK_EXPLORERS = {
  [CHAIN_IDS.SEPOLIA]: 'https://eth-sepolia.blockscout.com',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'https://sepolia.arbiscan.io',
} as const;

