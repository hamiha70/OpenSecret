# 💰 Profit/Loss Simulation Design

## Date: 2025-10-24

## 🎯 **Goal**
Enable realistic vault performance simulation without deploying separate strategy contracts.

---

## 🏗️ **Architecture Decision**

### **What We're Building:**
```
OmniVault = ERC7540 + IProfitLossRealizer
```

**NOT building:**
- ❌ Separate strategy contracts
- ❌ Complex DeFi integrations
- ❌ Multiple token support

**Building:**
- ✅ Vault with virtual profit/loss tracking
- ✅ Market bot with funding wallet
- ✅ Event emissions for Envio indexing

---

## 📊 **Component Breakdown**

### **1. IProfitLossRealizer Interface**

```solidity
interface IProfitLossRealizer {
    // Events for Envio indexing
    event ProfitRealized(address indexed token, uint256 amount, uint256 timestamp);
    event LossRealized(address indexed token, uint256 amount, uint256 timestamp);
    
    // Functions called by market bot
    function realizeProfit(address token, uint256 amount) external;
    function realizeLoss(address token, uint256 amount) external;
    function virtualProfitLoss() external view returns (int256);
}
```

**Purpose:** Clean abstraction for profit/loss simulation

---

### **2. Market Bot with Funding Wallet**

```
┌──────────────────────────────────────────┐
│          Market Simulation Bot           │
│                                          │
│  Wallet: 0x... (50-100 USDC funded)     │
│                                          │
│  Every hour:                             │
│  1. Simulate market conditions           │
│  2. Calculate profit or loss             │
│  3. If profit:                           │
│     - Transfer USDC to vault             │
│     - Call realizeProfit()               │
│  4. If loss:                             │
│     - Call realizeLoss()                 │
│     - Receive USDC from vault            │
└──────────────────────────────────────────┘
```

**Purpose:** Manages both virtual accounting AND actual token movements

---

### **3. Vault State Management**

```solidity
// State variables
int256 public virtualProfitLoss;  // Running total
address public simulator;          // Authorized bot address

// Modified totalAssets() calculation
function totalAssets() public view returns (uint256) {
    uint256 actualBalance = asset.balanceOf(address(this));
    int256 total = int256(actualBalance) + virtualProfitLoss;
    return total > 0 ? uint256(total) : 0;
}

// This affects share price!
function convertToAssets(uint256 shares) public view returns (uint256) {
    uint256 supply = totalSupply();
    return supply == 0 ? shares : (shares * totalAssets()) / supply;
}
```

**Key Insight:** `virtualProfitLoss` directly affects share price calculations!

---

## 🔄 **Complete Flow Example**

### **Scenario: 5% Profit Simulation**

```
T0: User deposits 100 USDC
    ├─ requestDeposit(100 USDC)
    ├─ [operator] claimDeposit(user)
    ├─ User gets 100 shares
    └─ Vault state:
        • Actual USDC: 100
        • Virtual P&L: 0
        • Total Assets: 100
        • Share Price: 1.00

T1: Market bot simulates profit (1 hour later)
    ├─ Bot calculates: 5% APY = +5 USDC profit
    ├─ Bot transfers: 5 USDC → Vault
    ├─ Bot calls: realizeProfit(USDC, 5e6)
    ├─ Event emitted: ProfitRealized(USDC, 5e6, timestamp)
    └─ Vault state:
        • Actual USDC: 105 ✅
        • Virtual P&L: +5
        • Total Assets: 105
        • Share Price: 1.05 ✅

T2: User redeems 100 shares
    ├─ requestRedeem(100 shares)
    ├─ [operator] claimRedeem(user)
    ├─ Contract calculates: convertToAssets(100) = 105 USDC
    ├─ User receives: 105 USDC ✅✅✅
    └─ Vault state:
        • Actual USDC: 0
        • Virtual P&L: +5 (but offset by 105 withdrawal)
        • Total Assets: 0
        • Perfect!
```

**User Experience:** ✅ Sees profit in UI ✅ Gets profit on withdrawal!

---

## 📊 **Envio Integration**

### **Events Indexed:**

```graphql
type Deposit @entity {
  id: ID!
  user: Bytes!
  assets: BigInt!
  shares: BigInt!
  timestamp: BigInt!
}

type Redeem @entity {
  id: ID!
  user: Bytes!
  shares: BigInt!
  assets: BigInt!
  timestamp: BigInt!
}

type ProfitRealization @entity {
  id: ID!
  token: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  cumulativeProfit: BigInt!
}

type LossRealization @entity {
  id: ID!
  token: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  cumulativeLoss: BigInt!
}

type VaultSnapshot @entity {
  id: ID!
  timestamp: BigInt!
  totalAssets: BigInt!
  virtualPL: BigInt!
  totalSupply: BigInt!
  sharePrice: BigDecimal!
}
```

### **GraphQL Queries:**

```graphql
# Get current vault state
query {
  vault(id: "0x1b1870ac...") {
    totalAssets
    virtualProfitLoss
    sharePrice
    lastUpdate
  }
}

# Get profit/loss history
query {
  profitRealizations(orderBy: timestamp, orderDirection: desc) {
    amount
    timestamp
    cumulativeProfit
  }
  
  lossRealizations(orderBy: timestamp, orderDirection: desc) {
    amount
    timestamp
    cumulativeLoss
  }
}

# Get performance chart data
query {
  vaultSnapshots(
    orderBy: timestamp
    orderDirection: asc
    where: { timestamp_gte: $startTime }
  ) {
    timestamp
    sharePrice
    totalAssets
  }
}
```

---

## ⚙️ **Implementation Checklist**

### **Phase 1: Contract Updates** ✅
- [ ] Create `IProfitLossRealizer.sol` interface
- [ ] Update `OmniVault.sol` to implement interface
- [ ] Add `virtualProfitLoss` state variable
- [ ] Add `simulator` address
- [ ] Implement `realizeProfit()` function
- [ ] Implement `realizeLoss()` function
- [ ] Modify `totalAssets()` to include virtual P&L
- [ ] Add `setSimulator()` configuration function
- [ ] Emit events: `ProfitRealized`, `LossRealized`

### **Phase 2: Testing** ✅
- [ ] Test profit realization flow
- [ ] Test loss realization flow
- [ ] Test only simulator can call
- [ ] Test wrong token reverts
- [ ] Test share price calculations
- [ ] Test user gets correct amounts on redeem
- [ ] Test multiple users with profit
- [ ] Test negative balance protection

### **Phase 3: Deployment** ✅
- [ ] Deploy updated OmniVault
- [ ] Verify on Blockscout
- [ ] Set simulator address
- [ ] Fund simulator wallet (50-100 testnet USDC)
- [ ] Update frontend config

### **Phase 4: Bot Development** 
- [ ] Create market simulation logic
- [ ] Implement profit/loss calculation
- [ ] Add wallet management
- [ ] Integrate with vault contract
- [ ] Add error handling
- [ ] Deploy to AWS ECS

### **Phase 5: Envio Indexer**
- [ ] Configure event tracking
- [ ] Create GraphQL schema
- [ ] Deploy indexer
- [ ] Test queries
- [ ] Integrate with frontend

---

## 🎯 **Design Decisions**

### **Why Virtual P&L + Actual Funding?**

| Approach | User Gets Real Profit | Gas Efficient | Simple |
|----------|----------------------|---------------|--------|
| Pure off-chain | ❌ No | ✅ Yes | ✅ Yes |
| Virtual only | ❌ Redeems fail | ✅ Yes | ✅ Yes |
| **Virtual + Funding** | **✅ Yes** | **✅ Yes** | **✅ Yes** |
| Real strategies | ✅ Yes | ❌ No | ❌ No |

**Winner:** Virtual P&L + Actual Funding ✅

### **Why No Separate Strategy Contract?**

**Benefits of no separate contract:**
- ✅ Simpler deployment (1 contract vs 2)
- ✅ Easier testing
- ✅ Less gas for users
- ✅ Bot can be off-chain service
- ✅ More flexible simulation logic

**Drawbacks:**
- ⚠️ Not how production DeFi works (but this is a demo!)

**Decision:** Perfect for hackathon, document as "simplified for demo"

### **Why Token Parameter in realizeProfit/Loss?**

Even though we only use USDC:
- ✅ Future-proof (could add other assets)
- ✅ Makes interface more general
- ✅ Explicit about what's being realized
- ✅ Better for Envio indexing (token address in events)

**Decision:** Keep token parameter, validate it's USDC

---

## 💰 **Funding Requirements**

### **Simulator Wallet:**
- **Amount:** 50-100 testnet USDC
- **Source:** Circle faucet (https://faucet.circle.com/)
- **Usage:** Fund profits, receive losses
- **Replenishment:** Can withdraw from vault using `realizeLoss()` if needed

### **Gas Costs:**
- `realizeProfit()`: ~50k gas
- `realizeLoss()`: ~75k gas (includes transfer)
- Frequency: Every 1 hour = 24 calls/day
- Daily cost: ~0.002 ETH on Sepolia

---

## 🎨 **Frontend Display**

```typescript
// Dashboard shows:
interface VaultMetrics {
  // From Envio (real data)
  actualUSDC: number,
  totalShares: number,
  
  // From contract (includes virtual P&L)
  totalAssets: number,
  sharePrice: number,
  
  // Computed
  virtualPL: number,  // totalAssets - actualUSDC
  profitPercent: number,  // (virtualPL / actualUSDC) * 100
  
  // From bot API (strategy breakdown)
  strategies: [
    { name: 'Aave USDC', apy: 4.2, allocation: 40% },
    { name: 'Compound', apy: 5.8, allocation: 35% },
    { name: 'Uniswap V3', apy: 7.1, allocation: 25% }
  ]
}
```

---

## ✅ **Why This Design is Excellent**

1. **Realistic UX** ✅
   - Users see real share price changes
   - Users get real profit on withdrawal
   - Dashboard shows realistic performance

2. **Simple Implementation** ✅
   - Only modify vault contract
   - No separate strategy deployment
   - Bot is off-chain service

3. **Fully Verifiable** ✅
   - All events on-chain
   - Envio indexes everything
   - Judges can see full history

4. **Cost Effective** ✅
   - Minimal testnet USDC needed (50-100)
   - Low gas costs
   - Easy to maintain

5. **Hackathon Perfect** ✅
   - Shows DeFi understanding
   - Demonstrates event-driven architecture
   - Integrates multiple technologies (Solidity, bots, Envio)
   - Looks production-ready

---

## 🚀 **Time Estimate**

| Task | Time |
|------|------|
| Create interface | 10 min |
| Update vault contract | 30 min |
| Write tests | 1 hour |
| Deploy + verify | 20 min |
| Bot development | 2 hours |
| Envio setup | 1 hour |
| Frontend integration | 1 hour |
| **TOTAL** | **~6 hours** |

---

## 📝 **Documentation for Judges**

**In your demo, explain:**
> "The vault implements a ProfitLossRealizer interface that allows a market simulation bot to adjust share prices based on simulated strategy performance. The bot manages a funding wallet that actually transfers USDC to/from the vault, ensuring users receive real profits on withdrawal. All profit and loss events are indexed by Envio for the dashboard. In production, this would be replaced by actual DeFi strategy contracts, but for the demo, this shows the complete user experience without the complexity of managing multiple protocols."

**Key talking point:**
> "Users don't just SEE simulated profits—they actually GET them when they withdraw!"

---

## ✅ **APPROVED DESIGN**

This architecture balances:
- ✅ Realistic user experience
- ✅ Implementation simplicity
- ✅ Verifiable on-chain events
- ✅ Hackathon time constraints
- ✅ Demo impact

**Ready to implement!** 🚀

