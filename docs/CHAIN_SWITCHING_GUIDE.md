# Chain Switching Guide 🔄

## Quick Reference

Switch between Ethereum Sepolia and Arbitrum Sepolia deployments easily!

---

## ⚡ Current Configuration

Check your `.env` file:

```bash
VAULT_CHAIN=arbitrum-sepolia
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME=Arbitrum Sepolia
```

---

## 🔄 How to Switch Chains

### Option 1: Arbitrum Sepolia (Current - for Avail Nexus L2 ↔ L2)

**Use when:** You want L2 ↔ L2 bridging via Avail Nexus

**Update `.env`:**
```bash
# Vault address (Arbitrum Sepolia)
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0xf286ae673a1a78bfb1fe1b5a24634ffdddb815aa
VAULT_ADDRESS=0xf286ae673a1a78bfb1fe1b5a24634ffdddb815aa

# Chain config
VAULT_CHAIN=arbitrum-sepolia
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME=Arbitrum Sepolia

# RPC
ARBITRUM_SEPOLIA_RPC_URL=https://snowy-cold-shape.arbitrum-sepolia.quiknode.pro/...
```

**Blockscout:** https://arbitrum-sepolia.blockscout.com/

**Pros:**
- ✅ Avail Nexus L2 ↔ L2 bridging works
- ✅ Can bridge from Base Sepolia, Optimism Sepolia, Polygon Amoy
- ✅ Real cross-chain demo

**Cons:**
- ❌ Limited Blockscout MCP support
- ❌ Arbiscan verification sometimes flaky

---

### Option 2: Ethereum Sepolia (for better tooling/debugging)

**Use when:** You need better Blockscout MCP support, debugging, or verification

**Update `.env`:**
```bash
# Vault address (Ethereum Sepolia - OLD deployment)
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
VAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9

# Chain config
VAULT_CHAIN=sepolia
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111
NEXT_PUBLIC_VAULT_CHAIN_NAME=Ethereum Sepolia

# RPC
ETHEREUM_SEPOLIA_RPC=https://capable-old-patina.ethereum-sepolia.quiknode.pro/...
```

**Update RPC in bots/simulator:**
```javascript
// operator-bot/index.js & frontend/app/api/market-simulator/route.ts
const RPC_URL = process.env.ETHEREUM_SEPOLIA_RPC
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Sepolia USDC
```

**Blockscout:** https://eth-sepolia.blockscout.com/

**Pros:**
- ✅ Better Blockscout MCP support
- ✅ More stable verification
- ✅ Better debugging tools

**Cons:**
- ❌ Avail Nexus L2 → L1 bridging NOT supported
- ❌ No real cross-chain demo

---

## 📝 After Switching

1. **Restart Next.js dev server:**
   ```bash
   # Kill and restart
   cd frontend
   npm run dev
   ```

2. **Restart operator bot** (if running):
   ```bash
   cd operator-bot
   npm start
   ```

3. **Clear browser cache** (or use incognito)

4. **Update MetaMask** to the correct network

---

## 🚀 Deploy to New Chain

If you need to deploy a fresh contract:

```bash
cd contracts-foundry

# For Arbitrum Sepolia
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url $ARBITRUM_SEPOLIA_RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify --verifier blockscout \
  --verifier-url https://arbitrum-sepolia.blockscout.com/api

# For Ethereum Sepolia
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url $ETHEREUM_SEPOLIA_RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify --verifier blockscout \
  --verifier-url https://eth-sepolia.blockscout.com/api
```

Then update `.env` with the new address!

---

## 🔍 Verification Commands

### Arbitrum Sepolia
```bash
forge verify-contract <ADDRESS> \
  src/AsyncVault.sol:AsyncVault \
  --verifier blockscout \
  --verifier-url https://arbitrum-sepolia.blockscout.com/api \
  --chain-id 421614 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,string,string)" \
    0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
    $DEPLOYER_ADDRESS \
    $SIMULATOR_ADDRESS \
    "Async USDC" \
    "asUSDC")
```

### Ethereum Sepolia
```bash
forge verify-contract <ADDRESS> \
  src/AsyncVault.sol:AsyncVault \
  --verifier blockscout \
  --verifier-url https://eth-sepolia.blockscout.com/api \
  --chain-id 11155111 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,string,string)" \
    0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
    $DEPLOYER_ADDRESS \
    $SIMULATOR_ADDRESS \
    "Async USDC" \
    "asUSDC")
```

---

## 📊 Deployed Contracts Reference

| Chain | Vault Address | USDC Address | Blockscout |
|-------|---------------|--------------|------------|
| **Arbitrum Sepolia** | `0xf286ae673a1a78bfb1fe1b5a24634ffdddb815aa` | `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d` | [View](https://arbitrum-sepolia.blockscout.com/address/0xf286ae673a1a78bfb1fe1b5a24634ffdddb815aa) |
| **Ethereum Sepolia** | `0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [View](https://eth-sepolia.blockscout.com/address/0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9) |

---

## ⚠️ Important Notes

1. **USDC Addresses are Different!**
   - Arbitrum Sepolia: `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d`
   - Ethereum Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

2. **RPC URLs are Different!**
   - Make sure to use the correct RPC for each chain

3. **Frontend uses `NEXT_PUBLIC_*` variables**
   - Backend/bots use regular variables

4. **Always verify contracts after deployment**

---

**Last Updated:** October 26, 2025

