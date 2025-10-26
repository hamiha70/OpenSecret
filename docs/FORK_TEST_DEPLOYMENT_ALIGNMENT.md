# Fork Test ↔ Deployment Script Alignment

## 📋 Summary

The fork test (`AsyncVault.fork.t.sol`) now uses **identical configuration** to the deployment script (`DeployAsyncVault.s.sol`), ensuring that tests accurately reflect production deployment.

---

## 🔗 Environment Variables Used

### Both Scripts Read (Identical)

| Variable | Purpose | Used By |
|----------|---------|---------|
| `SIMULATOR_ADDRESS` | Address for profit/loss simulator bot | Both |
| `ARBITRUM_SEPOLIA_RPC` / `ETHEREUM_SEPOLIA_RPC` | RPC URL for chain connection | Both |

### Deployment Script Only

| Variable | Purpose | Why Not in Fork Test |
|----------|---------|----------------------|
| `DEPLOYER_PRIVATE_KEY` | Private key for deploying | Tests use `DEPLOYER_ADDRESS` instead (no private keys in tests) |

### Fork Test Only

| Variable | Purpose | Why Not in Deployment |
|----------|---------|----------------------|
| `DEPLOYER_ADDRESS` | Deployer address (derived from private key in deployment) | Tests don't have access to private keys |
| `INVESTOR_ADDRESS` | Test investor account | Only needed for testing user flows |

---

## 🎯 Chain Selection Logic (Identical)

### Priority Order
1. **Try `ARBITRUM_SEPOLIA_RPC` first** (default)
2. **Fall back to `ETHEREUM_SEPOLIA_RPC`**

### Chain ID Detection
```solidity
uint256 chainId = block.chainid;

if (chainId == 11155111) {
    // Ethereum Sepolia
    usdcAddress = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
} else if (chainId == 421614) {
    // Arbitrum Sepolia  
    usdcAddress = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
} else {
    revert("Unsupported chain!");
}
```

**✅ Identical in both scripts**

---

## 🏗️ Vault Deployment Parameters (Identical)

| Parameter | Deployment Script | Fork Test | Match? |
|-----------|-------------------|-----------|--------|
| `asset` (USDC) | Auto-selected by chain ID | Auto-selected by chain ID | ✅ |
| `operator` | `deployer` address | `deployer` address | ✅ |
| `simulator` | `SIMULATOR_ADDRESS` from .env | `SIMULATOR_ADDRESS` from .env | ✅ |
| `name` | `"Async USDC"` | `"Async USDC"` | ✅ |
| `symbol` | `"asUSDC"` | `"asUSDC"` | ✅ |

---

## 🚀 Usage

### Run Fork Test on Arbitrum Sepolia
```bash
cd contracts-foundry
./test-fork-arb.sh
```

### Run Fork Test on Ethereum Sepolia
```bash
cd contracts-foundry
forge test --match-contract AsyncVaultForkTest --fork-url $ETHEREUM_SEPOLIA_RPC -vv
```

### Deploy to Arbitrum Sepolia
```bash
cd contracts-foundry
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url $ARBITRUM_SEPOLIA_RPC \
  --broadcast
```

### Deploy to Ethereum Sepolia
```bash
cd contracts-foundry
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url $ETHEREUM_SEPOLIA_RPC \
  --broadcast
```

---

## ✅ Benefits of Alignment

1. **Predictable Behavior**: Fork tests use exact same config as production
2. **Catch Issues Early**: Any deployment issues will show in fork tests
3. **Easy Chain Switching**: Both use same .env variables
4. **No Config Drift**: Single source of truth for all configuration

---

**Last Updated:** October 26, 2025
