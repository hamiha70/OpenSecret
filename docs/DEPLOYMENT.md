# AsyncVault Deployment

## Current Deployment (v5 - Arbitrum Sepolia - Production Ready)

**Network:** Arbitrum Sepolia (Chain ID: 421614)  
**Contract:** AsyncVault (ERC4626 + Centrifuge pattern + Operator)  
**Address:** `0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09`  
**USDC:** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` ✅ **CORRECT!**  
**Verification:** ✅ On Blockscout  
**Deployment Date:** October 26, 2025

### Why Arbitrum Sepolia?

**Previous Issue:** Deployed with wrong USDC address (Ethereum Sepolia USDC on Arbitrum Sepolia) ❌  
**Root Cause:** Hardcoded USDC address in deployment script  
**Solution:** Auto-detection by chain ID + Fork tests before deployment ✅

### Features
- ✅ Inherits from OpenZeppelin ERC4626
- ✅ Centrifuge pattern (assets calculated at claim time)
- ✅ Operator pattern for automated claiming
- ✅ User self-claim and operator claim both supported
- ✅ Profit/loss simulation via simulator role
- ✅ **29 comprehensive fork tests passing** on Arbitrum Sepolia
- ✅ **Auto-detects chain and selects correct USDC**

### Blockscout Links
- **Contract:** https://arbitrum-sepolia.blockscout.com/address/0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
- **USDC (Asset):** https://arbitrum-sepolia.blockscout.com/address/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d

### Previous Deployments
- v4 (Ethereum Sepolia): `0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9` (working, but on wrong chain for Avail)
- v3 (Arbitrum Sepolia - FAILED): `0xf286ae673a1a78bfb1fe1b5a24634ffdddb815aa` (wrong USDC address)
- v2 (pre-Centrifuge): `0x8A73589fe295A64e9085708636cb04a29c9c4461` (deprecated)
- v1 (missing For functions): `0x671E0EF681F18Bd0A0bD4122A3b06966e0013E10` (deprecated)

---

## Contract Configuration

### Constructor Arguments
```solidity
AsyncVault(
    address _asset,      // 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d (USDC Arbitrum Sepolia)
    address _operator,   // 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba (Deployer)
    address _simulator,  // 0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103 (Market Bot)
    string _name,        // "Async USDC"
    string _symbol       // "asUSDC"
)
```

### Account Roles

| Role | Address | Purpose |
|------|---------|---------|
| **Owner/Deployer** | `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba` | Contract owner, initial operator |
| **Operator** | `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba` | Can claim deposits/redeems on behalf of users |
| **Simulator** | `0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103` | Market bot for profit/loss simulation |
| **Investor** | `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba` | End-user test account |

### USDC Balances (Post-Faucet)

**Deployer/Investor:**
- Ethereum Sepolia: 51.76 USDC ✅
- **Arbitrum Sepolia: 20.50 USDC** ✅
- Optimism Sepolia: 10.00 USDC ✅
- Base Sepolia: 20.00 USDC ✅

**Simulator:**
- Ethereum Sepolia: 24.72 USDC ✅
- **Arbitrum Sepolia: 10.00 USDC** ✅ (Perfect for market simulation!)
- Optimism Sepolia: 10.00 USDC ✅
- Base Sepolia: 10.00 USDC ✅

---

## Deployment Transaction

**Gas Used:** 2,630,301  
**ETH Cost:** ~0.000263 ETH (at 0.1 gwei)  
**Timestamp:** October 26, 2025  
**Version:** v5 (Arbitrum Sepolia with auto-detection)

---

## Contract Features

### ERC-7540 Compliance
- Asynchronous deposit/redeem flow
- Request → Claim two-step process
- Centrifuge pattern (assets calculated at claim time, not snapshot)
- No reserve mechanism (Centrifuge pattern handles this)

### Operator Pattern
- Allows automated claiming via operator bot
- User can still self-claim if operator is offline
- Toggle-able in frontend for demo purposes

### Profit/Loss Realization
- `realizeProfit(token, amount)` - Simulator adds USDC to vault
- `realizeLoss(token, amount)` - Simulator removes USDC from vault
- Direct USDC transfers (no virtual accounting)
- Events emitted for indexer tracking

---

## How to Redeploy

The deployment script now **auto-detects** the chain and selects the correct USDC address!

### Deploy to Arbitrum Sepolia (Current)
```bash
cd contracts-foundry
source .env
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC" \
  --broadcast \
  --legacy
```

### Deploy to Ethereum Sepolia (Alternative)
```bash
cd contracts-foundry
source .env
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC" \
  --broadcast \
  --legacy
```

**The script will automatically:**
1. Detect chain ID (421614 or 11155111)
2. Select correct USDC address
3. Deploy with proper configuration
4. Fail if on unsupported chain

---

## Testing Before Deployment

**ALWAYS run fork tests before deploying!**

```bash
cd contracts-foundry
./test-fork-arb.sh  # For Arbitrum Sepolia
```

This will:
- Deploy to forked Arbitrum Sepolia
- Run 29 comprehensive tests
- Validate USDC address is correct
- Test full deposit/redeem cycle
- Test operator pattern
- Test profit/loss simulation

**If fork tests fail, DO NOT deploy!**

---

## How to Verify on Blockscout

Blockscout verification for Arbitrum Sepolia:

```bash
cd contracts-foundry
forge verify-contract \
  0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09 \
  src/AsyncVault.sol:AsyncVault \
  --verifier blockscout \
  --verifier-url https://arbitrum-sepolia.blockscout.com/api \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,string,string)" \
    0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
    0x36AB88fDd34848C0caF4599736a9D3a860D051Ba \
    0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103 \
    "Async USDC" \
    "asUSDC") \
  --watch
```

---

## Configuration Management

### Single Source of Truth
The vault address and chain are now managed via environment variables:

```bash
# AsyncVault Contract Address (update after each deployment)
ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09

# Vault Chain Configuration
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME="Arbitrum Sepolia"
```

**Benefits:**
- ✅ One place to update (just `.env`)
- ✅ All services automatically pick up new address
- ✅ Easy to switch between chains for testing
- ✅ Frontend automatically selects correct USDC

**What uses the env vars:**
- Frontend: `NEXT_PUBLIC_ASYNCVAULT_ADDRESS`, `NEXT_PUBLIC_VAULT_CHAIN_ID`
- Operator Bot: `ASYNCVAULT_ADDRESS`, `ARBITRUM_SEPOLIA_RPC`
- Market Simulator: `ASYNCVAULT_ADDRESS`, `ARBITRUM_SEPOLIA_RPC`

### After Each Deployment
1. Deploy contract (or run fork test first!)
2. Verify on Blockscout
3. Update `.env` with new address
4. Update `frontend/.env.local` with new address
5. Restart services (frontend, operator bot)
6. Test!

No code changes needed! 🚀

---

## Frontend Setup (Important!)

Next.js requires environment variables to be in `frontend/.env.local`:

```bash
cd frontend
echo "NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9" > .env.local
```

**Why?** Next.js doesn't read from the root `.env` file. It needs its own `.env.local`.

After creating this file, restart the frontend:
```bash
npm run dev
```

---

## Chain Switching Guide

To switch between Ethereum Sepolia and Arbitrum Sepolia:

### Switch to Ethereum Sepolia
```bash
# Update .env
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111
NEXT_PUBLIC_VAULT_CHAIN_NAME="Ethereum Sepolia"
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9

# Update frontend/.env.local (same values)
# Restart frontend and bots
```

### Switch to Arbitrum Sepolia (Current)
```bash
# Update .env
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME="Arbitrum Sepolia"
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09

# Update frontend/.env.local (same values)
# Restart frontend and bots
```

The frontend will automatically:
- Select correct USDC address for the chain
- Update all UI text with correct chain name
- Switch MetaMask to correct network

---

## Testing Checklist

- [x] Fork tests passed (29/29 tests) ✅
- [x] Deployment successful ✅
- [x] Correct USDC address verified ✅
- [x] Simulator funded with 10 USDC ✅
- [x] Frontend configs updated ✅
- [ ] Test deposit flow
- [ ] Test operator bot auto-claim
- [ ] Test market simulator profit/loss
- [ ] Test cross-chain deposit (Avail Nexus)
- [ ] Test redeem flow

---

## Key Improvements in v5

1. **Auto-Detection:** Deployment script detects chain ID and selects correct USDC ✅
2. **Fork Tests:** Comprehensive testing before deployment ✅
3. **Chain Agnostic:** Easy switching between Ethereum and Arbitrum Sepolia ✅
4. **Proper USDC:** No more wrong address errors ✅
5. **Well Funded:** Simulator has USDC across all chains for testing ✅

---

**Status:** 🚀 Ready for full integration testing on Arbitrum Sepolia!
