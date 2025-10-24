# OmniVault Smart Contracts

ERC-7540 Asynchronous Vault with Operator Pattern for Cross-Chain UX

## Overview

OmniVault is a single-chain vault on Ethereum Sepolia that holds USDC and implements:
- **ERC-7540** asynchronous deposit/redeem pattern
- **Operator pattern** for auto-claiming requests (enables 1-click UX)
- **Avail Nexus integration** for cross-chain user onboarding

## Architecture

```
┌─────────────┐      Avail Nexus Bridge      ┌─────────────┐
│  Any Chain  │ ────────────────────────────> │   Sepolia   │
│  (User)     │         (USDC)                │  OmniVault  │
└─────────────┘                               └─────────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │  Strategies │
                                              │  (Future)   │
                                              └─────────────┘
```

## Contracts

### OmniVault.sol

Main vault contract implementing ERC-7540 async pattern:

**Key Functions:**

1. **Deposit Flow**
   - `requestDeposit(uint256 assets)` - User requests to deposit USDC
   - `claimDeposit(address user)` - Operator fulfills request and mints shares

2. **Redeem Flow**
   - `requestRedeem(uint256 shares)` - User requests to redeem shares
   - `claimRedeem(address user)` - Operator fulfills request and returns USDC

3. **Admin Functions**
   - `setOperator(address)` - Update operator address
   - `setStrategy(address)` - Set strategy for yield generation (future)

## Testing

```bash
# Run all tests
forge test -vv

# Run specific test
forge test --match-test test_FullDepositRedeemFlow -vvv

# Coverage
forge coverage
```

**Test Results:** ✅ 25/25 passing

## Deployment

### Prerequisites

1. Set environment variables in `.env`:
```bash
MAIN_PRIVATE_KEY=0x...
ETHEREUM_SEPOLIA_RPC=https://...
ETHERSCAN_API_KEY=...
```

2. Ensure deployer has Sepolia ETH for gas

### Deploy

```bash
cd contracts-foundry

# Deploy to Sepolia
forge script script/DeployOmniVault.s.sol:DeployOmniVault \
  --rpc-url $ETHEREUM_SEPOLIA_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### Verify (if not done automatically)

```bash
forge verify-contract \
  --chain sepolia \
  --compiler-version v0.8.20 \
  <VAULT_ADDRESS> \
  src/OmniVault.sol:OmniVault \
  --constructor-args $(cast abi-encode "constructor(address,address,string,string)" \
    0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
    <OPERATOR_ADDRESS> \
    "OmniVault USDC" \
    "ovUSDC")
```

## Key Features

### 1. Asynchronous Pattern (ERC-7540)

Unlike traditional ERC-4626 vaults where `deposit()` is instant, OmniVault uses a 2-step flow:

```solidity
// Step 1: User requests deposit
vault.requestDeposit(1000 * 1e6); // 1000 USDC

// Step 2: Operator claims deposit (mints shares)
vault.claimDeposit(userAddress);
```

**Why?** This allows for:
- Cross-chain settlements
- Delayed processing
- Batch operations
- Operator automation

### 2. Operator Pattern

The operator can call `claimDeposit`/`claimRedeem` on behalf of users, enabling:
- **Frontend polling**: Detect pending requests and auto-claim
- **Bot automation**: Backend bot monitors events and claims
- **1-click UX**: Users only sign one transaction

### 3. Fair Share Pricing

Share calculation uses a **snapshot BEFORE deposit**:

```solidity
// Example:
// - Existing: 1000 USDC, 1000 shares
// - User deposits: 500 USDC
// - Shares minted: (500 * 1000) / 1000 = 500 shares ✅

totalAssetsBeforeDeposit = totalAssets() - request.assets;
shares = (request.assets * totalSupply()) / totalAssetsBeforeDeposit;
```

This prevents dilution and ensures fair pricing.

## Integration with Frontend

### 1. Connect to Vault

```typescript
const vaultABI = [...]; // OmniVault ABI
const vaultAddress = "0x..."; // Deployed address
const vault = new ethers.Contract(vaultAddress, vaultABI, signer);
```

### 2. Deposit Flow

```typescript
// 1. Approve USDC
await usdc.approve(vaultAddress, amount);

// 2. Request deposit
await vault.requestDeposit(amount);

// 3. Frontend polls for pending deposit
const pending = await vault.pendingDepositRequest(userAddress);
if (pending > 0) {
  // 4. Auto-claim (operator or user)
  await vault.claimDeposit(userAddress);
}
```

### 3. Redeem Flow

```typescript
// 1. Request redeem
await vault.requestRedeem(shares);

// 2. Frontend polls for pending redeem
const pending = await vault.pendingRedeemRequest(userAddress);
if (pending > 0) {
  // 3. Auto-claim
  await vault.claimRedeem(userAddress);
}
```

## Security Considerations

### Access Control

- **Owner**: Can set operator and strategy
- **Operator**: Can claim deposits/redeems for any user
- **Users**: Can always claim their own requests

### Reentrancy Protection

- Uses OpenZeppelin's `SafeERC20` for all transfers
- State updates before external calls (checks-effects-interactions)

### Pending Request Management

- Users cannot have multiple pending requests of the same type
- Fulfilled requests can be overwritten with new requests

## Future Enhancements

1. **Strategy Integration**
   - Aave lending for yield
   - Uniswap V3 liquidity provision
   - Automated rebalancing

2. **Multi-Token Support**
   - Accept deposits in multiple stablecoins
   - Auto-swap to USDC via Uniswap

3. **Advanced Operator Features**
   - Batch claiming for multiple users
   - Gas-optimized fulfillment
   - Off-chain signature verification

## License

MIT

## Links

- [Avail Nexus Docs](https://docs.availproject.org/nexus/)
- [ERC-7540 Spec](https://eips.ethereum.org/EIPS/eip-7540)
- [ERC-4626 Spec](https://eips.ethereum.org/EIPS/eip-4626)
