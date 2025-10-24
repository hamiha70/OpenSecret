# AsyncVault Architecture

## Overview

AsyncVault is an ERC-7540 compliant asynchronous vault that accepts USDC deposits and simulates yield generation. The project emphasizes **ERC-7540 compliance**, **operator automation**, and **Avail Nexus integration** for cross-chain user onboarding.

---

## Core Components

### 1. Smart Contracts (Foundry)

#### AsyncVault.sol
**Location:** `contracts-foundry/src/AsyncVault.sol`

**Features:**
- ERC-7540 asynchronous deposit/redeem flow
- ERC-20 share token (`asUSDC`)
- Operator pattern for automated claiming
- Reserve mechanism for guaranteed settlements
- Profit/loss realization interface

**Key Functions:**

```solidity
// Deposit Flow (ERC-7540)
function requestDeposit(uint256 assets) external
function claimDeposit(address receiver) external returns (uint256 shares)

// Redeem Flow (ERC-7540)
function requestRedeem(uint256 shares) external
function claimRedeem(address receiver) external returns (uint256 assets)

// Operator Actions
function claimDepositFor(address owner) external onlyOperator
function claimRedeemFor(address owner) external onlyOperator

// Market Simulation (IProfitLossRealizer)
function realizeProfit(address token, uint256 amount) external onlySimulator
function realizeLoss(address token, uint256 amount) external onlySimulator
```

**State Management:**
- `totalAssets()` - Total USDC balance (vault + strategy)
- `totalAssetsAvailable()` - Assets not reserved for redemptions
- `totalReserved` - Assets locked for pending redemptions
- `convertToShares()` / `convertToAssets()` - Fair pricing

#### IProfitLossRealizer.sol
**Location:** `contracts-foundry/src/interfaces/IProfitLossRealizer.sol`

Defines the interface for market simulation:
```solidity
interface IProfitLossRealizer {
    event ProfitRealized(address indexed token, uint256 amount, uint256 timestamp);
    event LossRealized(address indexed token, uint256 amount, uint256 timestamp);
    
    function realizeProfit(address token, uint256 amount) external;
    function realizeLoss(address token, uint256 amount) external;
    function simulator() external view returns (address);
}
```

---

### 2. Frontend (Next.js 14)

**Location:** `frontend/`

**Tech Stack:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Avail Nexus Widgets (`@avail-project/nexus-widgets`)

**Key Files:**
- `app/page.tsx` - Main UI component
- `config/contracts.ts` - Contract addresses and chain config
- `config/AsyncVault.abi.json` - Vault ABI

**Features:**
- MetaMask wallet connection
- USDC balance checking
- Avail Nexus bridge integration
- Vault deposit/redeem flow
- Auto-claiming with polling
- In-app transaction logs

---

## Key Design Decisions

### 1. ERC-7540 Asynchronous Flow

**Why ERC-7540?**
- Standard for vaults with delayed settlement (e.g., cross-chain, L2, illiquid strategies)
- Separates request (intent) from claim (execution)
- Prevents front-running and race conditions

**Two-Step Flow:**

**Deposit:**
1. User calls `requestDeposit(assets)` - transfers USDC, records intent
2. (Operator or user) calls `claimDeposit(receiver)` - mints shares

**Redeem:**
1. User calls `requestRedeem(shares)` - burns shares, **reserves assets**, records intent
2. (Operator or user) calls `claimRedeem(receiver)` - transfers USDC, **releases reserve**

### 2. Reserve Mechanism

**Problem:**
If profit/loss occurs between `requestRedeem()` and `claimRedeem()`, the vault could become underfunded or users could race to claim inflated values.

**Solution:**
- `requestRedeem()` calculates assets using current share price
- Immediately adds to `totalReserved` (locks those assets)
- `claimRedeem()` uses the **snapshotted** amount
- `realizeLoss()` cannot touch reserved assets

**Benefits:**
- Users guaranteed to receive their snapshotted amount
- No race conditions
- Full ERC-7540 compliance

**See:** [ERC7540_RESERVE_MECHANISM.md](ERC7540_RESERVE_MECHANISM.md)

### 3. Operator Pattern

**Problem:**
ERC-7540 requires 2 transactions (request + claim), which creates UX friction.

**Solution:**
- Vault has an `operator` address that can claim on behalf of users
- Operator bot polls for pending requests and auto-claims
- User can still self-claim if operator is offline

**Implementation:**
- Frontend: Polling mechanism checks pending requests every 3 seconds
- Backend (TODO): AWS bot monitors events and auto-claims

**Trade-offs:**
- **Self-Claim (Current):** User approves both transactions, full control, UX friction
- **Operator Bot (TODO):** User approves 1 transaction, better UX, requires trust in operator

**See:** [OPERATOR_PATTERN_EXPLAINED.md](OPERATOR_PATTERN_EXPLAINED.md)

### 4. Profit/Loss Simulation

**Approach:**
Direct USDC transfers (no virtual accounting)

**Profit:**
1. Simulator wallet transfers USDC to vault
2. Calls `realizeProfit(USDC, amount)`
3. Event emitted for indexer

**Loss:**
1. Calls `realizeLoss(USDC, amount)`
2. Vault transfers USDC to simulator
3. Event emitted for indexer

**Why Direct Transfers?**
- Real on-chain impact (not just accounting)
- Simpler contract logic
- Easy to verify via balances
- Aligns with user's request for "REAL ACTUAL USDC"

### 5. Three-Account Architecture

**Rationale:**
Separate roles for clarity, security, and realistic demo

| Role | Responsibility | Address (Sepolia) |
|------|---------------|-------------------|
| **Deployer** | Deploy contract, own it, act as operator | `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba` |
| **Investor** | End-user, deposit/redeem USDC | `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba` |
| **Simulator** | Market bot, realize profit/loss | `0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103` |

**Note:** Deployer and Investor share the same address for testing purposes.

### 6. Single-Chain Strategy

**Decision:**
Initially planned for multi-chain (Arbitrum, Optimism, Base Sepolia) but pivoted to single-chain (Ethereum Sepolia only).

**Reasons:**
1. **Avail SDK limitation:** Works in browser only, not in Node.js backend
2. **LayerZero not a sponsor:** Alternative omnichain solution not aligned with prizes
3. **Simplicity:** Single-chain reduces testing complexity
4. **Focus on core features:** ERC-7540 compliance, operator pattern, Avail onboarding

**Avail Integration:**
- Users can bridge USDC from any supported testnet to Sepolia
- Vault only operates on Sepolia
- Avail Nexus provides the cross-chain onboarding UX

---

## Data Flow

### Deposit Flow

```
User (Frontend)
  │
  ├─> 1. Approve USDC to Vault
  │
  ├─> 2. requestDeposit(amount)
  │       └─> Vault: transfer USDC, record pending request
  │
  ├─> 3. Polling: check pendingDepositRequest()
  │
  └─> 4. claimDeposit(user)
          └─> Vault: mint shares, clear pending request
```

### Redeem Flow

```
User (Frontend)
  │
  ├─> 1. requestRedeem(shares)
  │       └─> Vault: burn shares, reserve assets, record pending request
  │
  ├─> 2. Polling: check pendingRedeemRequest()
  │
  └─> 3. claimRedeem(user)
          └─> Vault: transfer USDC, release reserve, clear pending request
```

### Profit/Loss Flow

```
Simulator Bot (TODO)
  │
  ├─> Monitor market conditions
  │
  ├─> Decide profit or loss
  │
  ├─> Transfer USDC to vault (profit) OR
  │   Call realizeLoss (vault transfers out)
  │
  └─> realizeProfit() or realizeLoss()
          └─> Vault: emit event, update totalAssets()
```

---

## Testing Strategy

### Smart Contract Tests
**Location:** `contracts-foundry/test/AsyncVault.t.sol`

**Coverage:**
- Deployment validation
- Deposit flow (request → claim)
- Redeem flow (request → claim)
- Profit realization
- Loss realization
- Reserve mechanism (profit/loss between request and claim)
- Operator permissions
- Edge cases (zero amounts, invalid addresses, etc.)

**25 tests, 100% passing**

### Frontend Testing
**Manual testing with MetaMask:**
1. Connect wallet
2. Check USDC balance
3. Bridge USDC via Avail (optional)
4. Deposit USDC into vault
5. Verify shares minted
6. Redeem shares
7. Verify USDC returned

---

## Future Enhancements

### 1. Operator Bot
**Location:** TBD (AWS ECS Fargate)

**Features:**
- Listen for `DepositRequested` and `RedeemRequested` events
- Auto-call `claimDepositFor()` and `claimRedeemFor()`
- Gas management
- Error handling

**Tech Stack:**
- Node.js/TypeScript
- Ethers.js
- AWS ECS (or Lambda)
- Terraform for IaC

### 2. Market Simulator Bot
**Location:** TBD (AWS ECS Fargate)

**Features:**
- Simulate market conditions
- Call `realizeProfit()` / `realizeLoss()` periodically
- Transfer USDC to/from vault
- Emit events for indexer

**Parameters:**
- Frequency: Every 5 minutes
- Profit range: +1% to +5%
- Loss range: -1% to -3%
- Randomized for realism

### 3. Envio Indexer
**Purpose:**
- Track all vault events (deposits, redeems, profit/loss)
- Provide GraphQL API for dashboard
- Real-time vault state

**Schema:**
- `Deposit` entity
- `Redeem` entity
- `ProfitLoss` entity
- `VaultSnapshot` entity (hourly)

### 4. Dashboard UI
**Features:**
- Historical vault performance
- Total value locked (TVL)
- Share price chart
- User deposit/redeem history
- Profit/loss timeline

---

## Security Considerations

### Access Control
- **Owner:** Can set operator and simulator addresses
- **Operator:** Can only claim deposits/redeems on behalf of users (cannot steal funds)
- **Simulator:** Can only realize profit/loss (cannot access user funds directly)

### Reserve Mechanism
- Prevents vault underfunding
- Guarantees user redemptions
- Protects against race conditions

### OpenZeppelin Libraries
- `SafeERC20` for safe token transfers
- `Ownable` for access control
- `ERC20` for share token

### No Reentrancy Risks
- All external calls happen after state updates
- No user-controlled callbacks
- Following checks-effects-interactions pattern

---

## Deployment

**Network:** Ethereum Sepolia  
**Contract:** `0x31144B67A0003f88a53c011625DCC28713CeB9AB`  
**Verification:** ✅ Blockscout  

**See:** [DEPLOYMENT.md](DEPLOYMENT.md) for full details

---

## Technical Debt / TODOs

1. ⏳ Implement operator bot
2. ⏳ Implement market simulator bot
3. ⏳ Deploy bots to AWS
4. ⏳ Set up Envio indexer
5. ⏳ Build dashboard UI
6. ⏳ Add more sophisticated yield strategies (beyond simulation)
7. ⏳ Gas optimization (batch claims, etc.)
8. ⏳ Add pause/unpause functionality for emergencies

---

**Last Updated:** October 24, 2025

