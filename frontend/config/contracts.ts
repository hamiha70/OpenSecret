/**
 * Contract addresses and configuration
 */

export const CONTRACTS = {
  // AsyncVault deployed on Ethereum Sepolia (with operator pattern)
  vault: {
    address: '0x8A73589fe295A64e9085708636cb04a29c9c4461' as const,
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

