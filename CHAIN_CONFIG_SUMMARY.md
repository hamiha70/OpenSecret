# 🔧 Chain Configuration - Fully Dynamic

## Overview

All services (frontend, operator bot, market simulator) now auto-configure based on **ONE variable**:

```bash
NEXT_PUBLIC_VAULT_CHAIN_ID=421614  # Arbitrum Sepolia
```

Or:

```bash
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111  # Ethereum Sepolia
```

---

## Auto-Selected Configurations

### Arbitrum Sepolia (421614)
```
USDC:  0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
RPC:   $ARBITRUM_SEPOLIA_RPC
Chain: arbitrum-sepolia
```

### Ethereum Sepolia (11155111)
```
USDC:  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
RPC:   $ETHEREUM_SEPOLIA_RPC
Chain: ethereum-sepolia
```

---

## Files Updated for Dynamic Config

### 1. Operator Bot (`frontend/app/api/operator-bot/route.ts`)
```typescript
const VAULT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_VAULT_CHAIN_ID || '421614')
const RPC_URL = VAULT_CHAIN_ID === 11155111 
  ? process.env.ETHEREUM_SEPOLIA_RPC 
  : process.env.ARBITRUM_SEPOLIA_RPC
```

### 2. Market Simulator (`frontend/app/api/market-simulator/route.ts`)
```typescript
const VAULT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_VAULT_CHAIN_ID || '421614')

const USDC_ADDRESS = VAULT_CHAIN_ID === 11155111 
  ? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'  // Ethereum Sepolia
  : '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'  // Arbitrum Sepolia

const RPC_URL = VAULT_CHAIN_ID === 11155111
  ? process.env.ETHEREUM_SEPOLIA_RPC
  : process.env.ARBITRUM_SEPOLIA_RPC
```

### 3. Frontend (`frontend/app/page.tsx`)
```typescript
const VAULT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_VAULT_CHAIN_ID || '421614')
const VAULT_CHAIN_NAME = process.env.NEXT_PUBLIC_VAULT_CHAIN_NAME || 'Arbitrum Sepolia'

const getVaultChainUSDC = () => {
  switch(VAULT_CHAIN_ID) {
    case 11155111: return USDC_SEPOLIA      // Ethereum Sepolia
    case 421614: return USDC_ARB_SEPOLIA    // Arbitrum Sepolia
    case 84532: return USDC_BASE_SEPOLIA    // Base Sepolia
    default: return USDC_ARB_SEPOLIA
  }
}
```

---

## Required `.env` Variables

### Shared (Root `.env` and `frontend/.env.local`)
```bash
# Vault Configuration
VAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME="Arbitrum Sepolia"

# RPC URLs
ETHEREUM_SEPOLIA_RPC=<your-ethereum-sepolia-rpc>
ARBITRUM_SEPOLIA_RPC=<your-arbitrum-sepolia-rpc>

# Private Keys
DEPLOYER_PRIVATE_KEY=<deployer-key>
SIMULATOR_PRIVATE_KEY=<simulator-key>
```

---

## How to Switch Chains

### Example: Switch to Ethereum Sepolia

1. **Update `.env`:**
```bash
VAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111
NEXT_PUBLIC_VAULT_CHAIN_NAME="Ethereum Sepolia"
```

2. **Update `frontend/.env.local`:**
```bash
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
VAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111
NEXT_PUBLIC_VAULT_CHAIN_NAME="Ethereum Sepolia"
```

3. **Restart frontend:**
```bash
# In frontend terminal: Ctrl+C
npm run dev
```

4. **All services auto-configure:**
   - ✅ Operator bot → Ethereum Sepolia RPC
   - ✅ Market simulator → Ethereum Sepolia USDC + RPC
   - ✅ Frontend → Ethereum Sepolia USDC contract

**No code changes needed!** 🎉

---

## Current Configuration (Arbitrum Sepolia)

```bash
Chain ID:    421614
Chain Name:  Arbitrum Sepolia
Vault:       0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
USDC:        0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
RPC:         $ARBITRUM_SEPOLIA_RPC
```

---

## Verification

After restart, check logs for correct chain:

```
[Operator Bot] Connected to arbitrum-sepolia (Chain 421614) ✅
[Market Simulator] Connected to arbitrum-sepolia (Chain 421614) ✅
```

**Date:** October 26, 2025
