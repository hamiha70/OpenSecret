# AsyncVault Deployment

## Deployment Details

**Network:** Ethereum Sepolia (Chain ID: 11155111)
**Contract:** AsyncVault
**Address:** `0x31144B67A0003f88a53c011625DCC28713CeB9AB`
**Verification:** ✅ Verified on Blockscout

### Blockscout Links
- **Contract:** https://eth-sepolia.blockscout.com/address/0x31144B67A0003f88a53c011625DCC28713CeB9AB
- **USDC (Asset):** https://eth-sepolia.blockscout.com/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

## Contract Configuration

### Constructor Arguments
```solidity
AsyncVault(
    address _asset,      // 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (USDC Sepolia)
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

### Initial Balances

**Deployer/Investor:**
- ETH: 3.40
- USDC: 43.71

**Simulator:**
- ETH: 0.30
- USDC: 15.00

## Deployment Transaction

**Gas Used:** 2,427,893
**ETH Cost:** ~0.0024 ETH
**Timestamp:** October 24, 2025

## Contract Features

### ERC-7540 Compliance
- Asynchronous deposit/redeem flow
- Request → Claim two-step process
- Reserve mechanism to prevent underfunding
- Snapshot-based redemption values

### Operator Pattern
- Allows automated claiming via operator bot
- User can still self-claim if operator is offline
- Toggle-able in frontend for demo purposes

### Profit/Loss Realization
- `realizeProfit(token, amount)` - Simulator adds USDC to vault
- `realizeLoss(token, amount)` - Simulator removes USDC from vault
- Direct USDC transfers (no virtual accounting)
- Events emitted for indexer tracking

## Next Steps

1. ✅ Deploy contract to Sepolia
2. ✅ Verify on Blockscout
3. ✅ Update frontend configuration
4. ⏳ Test vault flow (deposit → profit → redeem)
5. ⏳ Build operator bot (auto-claim)
6. ⏳ Build market simulator bot (profit/loss)
7. ⏳ Set up Envio indexer
8. ⏳ Deploy to AWS with Terraform

## How to Redeploy

If you need to redeploy the contract:

```bash
cd contracts-foundry
source .env
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC" \
  --broadcast \
  -vvvv
```

## How to Verify

```bash
cd contracts-foundry
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/AsyncVault.sol:AsyncVault \
  --verifier blockscout \
  --verifier-url https://eth-sepolia.blockscout.com/api \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,string,string)" \
    0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
    0x36AB88fDd34848C0caF4599736a9D3a860D051Ba \
    0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103 \
    "Async USDC" \
    "asUSDC") \
  --watch
```

