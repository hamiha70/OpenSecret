# Cross-Chain Vault: Refined Architecture
## Simplified MVP with Multi-Strategy Focus

**Date:** October 22, 2025  
**Status:** Architecture Design  
**Timeline:** 5 days to deadline

---

## 🎯 Core Concept (Refined)

**What you're building:**
1. **3 ERC-4626 vaults** (Arbitrum, Optimism, Base) - accept deposits
2. **Multiple strategies per chain** (3-4 simple strategies per vault)
3. **Background script** - simulates strategy performance (random gains/losses)
4. **Envio indexing** - tracks vault deposits, strategy allocations, rebalancing events
5. **Cross-chain rebalancing** - via Avail Nexus when strategy on Chain B performs better than Chain A
6. **Share accounting** - handles deposits/withdrawals with accurate share price calculation

**This is MUCH better scoped.** ✅

---

## 🏗️ Architecture Breakdown

### 1. **Vault Layer (Smart Contracts)**

#### Per-Chain Vault (ERC-4626 Standard)

```solidity
// Arbitrum, Optimism, Base - Same contract, different deployments
contract CrossChainVault is ERC4626 {
    address[] public strategies;  // List of strategy addresses
    mapping(address => uint256) public strategyAllocations;  // % of TVL per strategy
    
    // ERC-4626 standard functions
    function deposit(uint256 assets, address receiver) public returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares);
    
    // Custom: Multi-strategy allocation
    function allocateToStrategy(address strategy, uint256 amount) external onlyOwner;
    function withdrawFromStrategy(address strategy, uint256 amount) external onlyOwner;
    
    // Custom: Cross-chain coordination (called by bot)
    function bridgeToChain(uint256 chainId, uint256 amount) external onlyOwner;
    
    // Share price calculation (includes all strategy balances)
    function totalAssets() public view override returns (uint256) {
        uint256 total = address(this).balance;
        for (uint i = 0; i < strategies.length; i++) {
            total += IStrategy(strategies[i]).balanceOf(address(this));
        }
        return total;
    }
}
```

**Key Points:**
- ✅ Standard ERC-4626 (judges like standards)
- ✅ Multi-strategy support (novel for cross-chain)
- ✅ `totalAssets()` aggregates across strategies (critical for share price)
- ⚠️ Owner-controlled (centralized, but acceptable for hackathon)

---

### 2. **Strategy Layer (Smart Contracts)**

#### Simple Strategy Interface

```solidity
interface IStrategy {
    function deposit() external payable;  // Vault deposits into strategy
    function withdraw(uint256 amount) external;  // Vault withdraws from strategy
    function balanceOf(address owner) external view returns (uint256);  // Current value
    function reportProfit(uint256 profit) external;  // Bot reports gains
    function reportLoss(uint256 loss) external;  // Bot reports losses
}
```

#### Example Strategy Implementations

**Strategy A: "Uniswap V3 LP" (Fake)**
```solidity
contract UniswapV3Strategy is IStrategy {
    mapping(address => uint256) public deposits;
    
    function deposit() external payable {
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount);
        deposits[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return deposits[owner];
    }
    
    // Bot calls this to simulate yield
    function reportProfit(uint256 profit) external onlyOwner {
        deposits[address(vault)] += profit;
        emit ProfitReported(profit);
    }
    
    function reportLoss(uint256 loss) external onlyOwner {
        deposits[address(vault)] -= loss;
        emit LossReported(loss);
    }
}
```

**Strategy B: "Aave Lending" (Fake)**
**Strategy C: "Compound Lending" (Fake)**
**Strategy D: "Yearn Integration" (Fake)**

**Why "Fake"?**
- You're NOT actually integrating with Uniswap/Aave (that's 2+ days of work)
- You're simulating strategy behavior (gains/losses)
- Judges understand this is a DEMO (they care about the architecture, not real yields)

**Critical:** Name them realistically, but implement them as simple deposit/withdraw + profit/loss tracking contracts.

---

### 3. **Background Script (Python Bot)**

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Background Bot                          │
│  (Python script running on your laptop/cloud)               │
├─────────────────────────────────────────────────────────────┤
│  Jobs:                                                      │
│   1. Strategy Performance Simulator (every 5 minutes)       │
│   2. Cross-Chain Rebalancer (every 10 minutes)             │
│   3. Reward Distributor (every 15 minutes)                 │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ Arbitrum │        │ Optimism │        │   Base   │
   │  Vault   │ ←────→ │  Vault   │ ←────→ │  Vault   │
   └──────────┘  Avail └──────────┘  Avail └──────────┘
        │                    │                    │
    ┌───┴───┐            ┌───┴───┐            ┌───┴───┐
    │ Strat │            │ Strat │            │ Strat │
    │ A B C │            │ A B C │            │ A B C │
    └───────┘            └───────┘            └───────┘
```

#### Python Script (Simplified)

```python
import asyncio
from web3 import Web3
from avail_nexus import NexusSDK
import random

class VaultOrchestrator:
    def __init__(self):
        self.chains = {
            'arbitrum': Web3('https://sepolia.arbitrum.io/rpc'),
            'optimism': Web3('https://sepolia.optimism.io'),
            'base': Web3('https://sepolia.base.org')
        }
        self.nexus = NexusSDK()
        self.vaults = {...}  # Vault contract instances
        self.strategies = {...}  # Strategy contract instances
    
    async def simulate_strategy_performance(self):
        """Randomly generate profits/losses for each strategy"""
        for chain in self.chains:
            for strategy in self.strategies[chain]:
                # Random performance: -2% to +5% per 5 minutes
                performance = random.uniform(-0.02, 0.05)
                current_balance = strategy.functions.balanceOf(vault_address).call()
                
                if performance > 0:
                    profit = int(current_balance * performance)
                    tx = strategy.functions.reportProfit(profit).transact()
                    print(f"[{chain}] Strategy {strategy.address}: +{performance*100:.2f}%")
                else:
                    loss = int(current_balance * abs(performance))
                    tx = strategy.functions.reportLoss(loss).transact()
                    print(f"[{chain}] Strategy {strategy.address}: {performance*100:.2f}%")
                
                await asyncio.sleep(1)
    
    async def rebalance_across_chains(self):
        """Move funds from low-yield to high-yield chains"""
        # Calculate average yield per chain
        yields = {}
        for chain in self.chains:
            total_value = 0
            total_profit = 0
            for strategy in self.strategies[chain]:
                balance = strategy.functions.balanceOf(vault_address).call()
                # Track profit over time (simplified)
                total_value += balance
                total_profit += self.get_strategy_profit(strategy)
            yields[chain] = total_profit / total_value if total_value > 0 else 0
        
        # Find best and worst chains
        best_chain = max(yields, key=yields.get)
        worst_chain = min(yields, key=yields.get)
        
        # Rebalance if difference > 5%
        if yields[best_chain] - yields[worst_chain] > 0.05:
            amount_to_move = self.calculate_rebalance_amount(worst_chain, best_chain)
            
            # Withdraw from worst chain strategies
            await self.withdraw_from_strategies(worst_chain, amount_to_move)
            
            # Bridge via Avail Nexus
            print(f"🔄 Rebalancing: {worst_chain} → {best_chain} ({amount_to_move} USDC)")
            await self.nexus.bridge(
                from_chain=worst_chain,
                to_chain=best_chain,
                amount=amount_to_move
            )
            
            # Deposit into best chain strategies
            await self.deposit_to_strategies(best_chain, amount_to_move)
    
    async def run(self):
        """Main loop"""
        while True:
            # Job 1: Simulate strategy performance (every 5 min)
            await self.simulate_strategy_performance()
            await asyncio.sleep(300)
            
            # Job 2: Rebalance (every 10 min)
            if self.should_rebalance():
                await self.rebalance_across_chains()
            await asyncio.sleep(600)

# Run
orchestrator = VaultOrchestrator()
asyncio.run(orchestrator.run())
```

**Key Points:**
- ✅ Simulates strategy performance (realistic demo)
- ✅ Triggers cross-chain rebalancing (shows Avail integration)
- ✅ Runs in background (set it and forget it during demo)
- ⚠️ Centralized (but transparent - you show the script in demo)

---

### 4. **Accounting Layer (Critical)**

#### The Challenge

**Problem:**
```
User A deposits 100 USDC when vault has 1000 USDC across strategies.
→ Vault mints shares based on current share price.
→ Strategies gain 10% (now 1100 USDC total).
→ User B deposits 100 USDC.
→ User B should get FEWER shares (because share price increased).

How do you calculate this across chains?
```

#### The Solution (Simplified for Hackathon)

**Option 1: Per-Chain Share Price (RECOMMENDED)**

Each vault calculates share price independently:

```solidity
function totalAssets() public view override returns (uint256) {
    uint256 total = IERC20(asset).balanceOf(address(this));  // Idle capital
    
    // Add all strategy balances on THIS chain
    for (uint i = 0; i < strategies.length; i++) {
        total += IStrategy(strategies[i]).balanceOf(address(this));
    }
    
    return total;
}

// Share price (from ERC-4626 standard)
function convertToShares(uint256 assets) public view returns (uint256) {
    uint256 supply = totalSupply();
    return supply == 0 ? assets : assets.mulDiv(supply, totalAssets());
}
```

**Key Points:**
- ✅ Each chain's vault is independent
- ✅ Share price based on local strategies only
- ✅ Users on Arbitrum get different share price than Optimism (that's OK!)
- ✅ No cross-chain state sync needed (simpler)

**Tradeoff:**
- ⚠️ Not a "true" unified vault (shares are per-chain)
- ✅ But your bot aggregates total TVL for UI display
- ✅ Judges will accept this as a reasonable hackathon simplification

**Option 2: Oracle-Based Unified Price (HARDER, NOT RECOMMENDED)**

```solidity
// Vault on Arbitrum needs to know Optimism + Base TVL
function totalAssets() public view returns (uint256) {
    uint256 local = _getLocalAssets();
    uint256 optimism = oracle.getTVL(OPTIMISM_CHAIN_ID);  // Chainlink CCIP or custom oracle
    uint256 base = oracle.getTVL(BASE_CHAIN_ID);
    return local + optimism + base;
}
```

**Why NOT do this:**
- 🔴 Requires cross-chain messaging (Chainlink CCIP, LayerZero, or custom)
- 🔴 Adds 1-2 days of complexity
- 🔴 Oracles on testnets are unreliable
- 🔴 Not worth it for hackathon

---

### 5. **Envio Indexing Layer**

#### What to Index

**Events from Vaults:**
```solidity
event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
event Withdraw(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
event StrategyAllocated(address indexed strategy, uint256 amount);
event StrategyWithdrawn(address indexed strategy, uint256 amount);
event CrossChainBridge(uint256 toChainId, uint256 amount);
```

**Events from Strategies:**
```solidity
event ProfitReported(uint256 profit);
event LossReported(uint256 loss);
event Rebalanced(address indexed strategy, uint256 newBalance);
```

#### Envio Configuration

```yaml
# envio.config.yaml
name: cross-chain-vault-indexer
networks:
  - id: 421614  # Arbitrum Sepolia
    rpc: https://sepolia.arbitrum.io/rpc
  - id: 11155420  # Optimism Sepolia
    rpc: https://sepolia.optimism.io
  - id: 84532  # Base Sepolia
    rpc: https://sepolia.base.org

contracts:
  - name: CrossChainVault
    abi: ./abis/CrossChainVault.json
    addresses:
      - network: arbitrum
        address: "0x..."
      - network: optimism
        address: "0x..."
      - network: base
        address: "0x..."
    events:
      - Deposit
      - Withdraw
      - StrategyAllocated
      - CrossChainBridge
  
  - name: Strategy
    abi: ./abis/Strategy.json
    addresses:
      # All strategy addresses
    events:
      - ProfitReported
      - LossReported
```

#### What Envio Gives You

**GraphQL Queries:**
```graphql
# Get total TVL across all chains
query TotalTVL {
  vaults {
    chainId
    address
    totalAssets
    totalShares
    sharePrice
  }
}

# Get user's positions
query UserPosition($address: String!) {
  deposits(where: { owner: $address }) {
    vault {
      chainId
      address
    }
    assets
    shares
    timestamp
  }
}

# Get strategy performance
query StrategyPerformance {
  strategies {
    address
    chainId
    totalProfits
    totalLosses
    netYield
  }
}

# Get rebalancing events
query RebalancingHistory {
  crossChainBridges(orderBy: timestamp, orderDirection: desc) {
    fromChain
    toChain
    amount
    timestamp
    txHash
  }
}
```

**Dashboard Display:**
- Total TVL across all chains (aggregated)
- TVL breakdown per chain
- Strategy performance (% gains)
- Recent deposits/withdrawals
- Rebalancing history

---

## 🤔 Your Specific Questions

### Q1: "Should the vault accept multiple ERC-20s and/or ETH?"

**Short Answer: NO. Use USDC only.**

**Why:**

| Multi-Asset Vault | Single-Asset Vault (USDC) |
|-------------------|---------------------------|
| 🔴 Complex: Need price oracles for each asset | ✅ Simple: One asset, one price |
| 🔴 Complex: Swap logic (Uniswap integration) | ✅ No swaps needed |
| 🔴 Complex: Share price calculation across assets | ✅ Direct share price (USDC in / USDC out) |
| 🔴 Time: +2 days | ✅ Time: Standard ERC-4626 |
| ⚠️ Judges: "This is cool but does it work?" | ✅ Judges: "This is clean and works" |

**Standard ERC-4626 Vaults (Yearn, Rari, etc.):**
- All accept SINGLE asset (e.g., USDC vault, DAI vault, WETH vault)
- This is how production vaults work
- Judges expect this

**If you REALLY want multi-asset (not recommended):**
- Add it as a "stretch goal" on Day 5
- Focus on USDC vault first
- Only add ETH/WBTC if you finish early (you won't)

**Recommendation: USDC only. It's standard. Judges expect it. Don't add complexity.**

---

### Q2: "The vault needs to account for cross-strategy and cross-chain deposits?"

**Short Answer: YES, but keep it simple (per-chain accounting).**

**Your Accounting Options:**

#### Option A: Per-Chain Accounting (RECOMMENDED)

**How it works:**
```
Arbitrum Vault:
  - Tracks: Deposits on Arbitrum + Strategy balances on Arbitrum
  - Share price: Based on Arbitrum TVL only
  - Does NOT care about Optimism/Base

Optimism Vault:
  - Tracks: Deposits on Optimism + Strategy balances on Optimism
  - Share price: Based on Optimism TVL only
  - Does NOT care about Arbitrum/Base

Your UI (powered by Envio):
  - Aggregates: Shows user their TOTAL position across all chains
  - But on-chain: Each vault is independent
```

**Pros:**
- ✅ Simple (standard ERC-4626 per chain)
- ✅ No cross-chain messaging needed
- ✅ Fast to implement (1 day)
- ✅ Testable (each vault works independently)

**Cons:**
- ⚠️ Share prices diverge across chains (Arbitrum share = 1.05 USDC, Optimism share = 1.03 USDC)
- ⚠️ Not "true" unified vault

**But:**
- ✅ Your bot rebalances to keep yields similar (so prices stay close)
- ✅ Judges understand this is a reasonable tradeoff for hackathon
- ✅ You can explain: "On production, we'd use Chainlink CCIP for unified price"

---

#### Option B: Unified Accounting via Oracle (NOT RECOMMENDED)

**How it works:**
```
Arbitrum Vault:
  - Queries oracle: "What's the TVL on Optimism + Base?"
  - Calculates: Total TVL = Local + Optimism + Base
  - Share price: Based on global TVL

Oracle (Chainlink CCIP or custom):
  - Aggregates TVL from all chains
  - Updates every N blocks
```

**Pros:**
- ✅ "True" unified vault (same share price everywhere)
- ✅ More impressive (if it works)

**Cons:**
- 🔴 Complex (Chainlink CCIP on 3 testnets)
- 🔴 Slow (cross-chain messages take 10-30 minutes)
- 🔴 Unreliable on testnets (message failures)
- 🔴 Time: +2 days
- 🔴 Risk: High (could break right before demo)

**Recommendation: DON'T DO THIS. Not worth it for hackathon.**

---

#### Option C: Centralized Oracle (Your Bot) (MIDDLE GROUND)

**How it works:**
```
Your Bot:
  - Every 5 minutes: Queries all 3 vaults
  - Calculates: Global TVL = Sum of all vaults
  - Writes: Updates a "GlobalTVL" variable on each vault

Vaults:
  - Use globalTVL for share price calculation
  - Trust your bot to update it
```

**Pros:**
- ✅ Simpler than Chainlink
- ✅ Works (no cross-chain messaging failures)
- ✅ "Unified" share price (close enough)

**Cons:**
- ⚠️ Centralized (your bot can lie)
- ⚠️ Judges ask: "What if bot goes down?" (Answer: "In production, we'd use Chainlink")

**Recommendation: THIS is a good middle ground IF you want unified pricing. But per-chain is still simpler.**

---

### Q3: "Does this architecture make sense?"

**YES.** ✅

**What you've proposed:**
1. ✅ 3 vaults (Arbitrum, Optimism, Base)
2. ✅ Multiple strategies per vault (3-4 fake strategies)
3. ✅ Background script simulates performance
4. ✅ Envio indexes events
5. ✅ Rebalancing via Avail Nexus
6. ✅ Standard ERC-4626 accounting

**This is a STRONG architecture for a 5-day hackathon.**

---

## ✂️ Refined Scope (With Your Changes)

### Core (3 days):
1. ✅ **3 ERC-4626 vaults** (Arbitrum, Optimism, Base) - USDC only
2. ✅ **3-4 fake strategies per chain** (Uniswap LP, Aave, Compound, Yearn)
3. ✅ **Strategy interface** (deposit, withdraw, reportProfit, reportLoss)
4. ✅ **Per-chain accounting** (each vault independent)
5. ✅ **Avail Nexus bridging** (for rebalancing)

### Integration (1 day):
6. ✅ **Background Python bot**:
   - Simulate strategy performance (random +/- gains)
   - Trigger rebalancing when yields diverge
   - Run continuously during demo
7. ✅ **Envio indexing**:
   - Vault events (deposits, withdrawals)
   - Strategy events (profits, losses)
   - Rebalancing events

### UI (1 day):
8. ✅ **Dashboard**:
   - Total TVL (aggregated across chains)
   - TVL per chain
   - Strategy performance (chart showing gains)
   - Recent deposits/withdrawals
   - Rebalancing history
9. ✅ **Deposit/Withdraw UI**:
   - Connect wallet (MetaMask)
   - Select chain
   - Deposit USDC → Get shares
   - Withdraw shares → Get USDC + profits

---

## ⏰ Revised Timeline

### TODAY (Oct 22):
- [ ] **Test Avail Nexus SDK** (30 min) - Can you bridge USDC?
- [ ] **Get testnet USDC** (1 hour) - Faucets on 3 chains
- [ ] **Write ERC-4626 vault contract** (2 hours) - Use OpenZeppelin
- [ ] **Write simple strategy contracts** (2 hours) - Deposit/withdraw/report interface
- [ ] **Deploy to one testnet** (1 hour) - Arbitrum Sepolia

**End of Day: You should have a working vault + 2-3 strategies on Arbitrum.**

---

### Day 2 (Oct 23):
- [ ] **Deploy to 2 more chains** (2 hours) - Optimism, Base
- [ ] **Avail bridging integration** (3 hours) - Test cross-chain USDC transfer
- [ ] **Python bot skeleton** (2 hours) - Connect to all 3 vaults
- [ ] **Test deposit → bridge → deposit flow** (1 hour)

**End of Day: 3 vaults deployed, Avail bridging works, bot can read vault state.**

---

### Day 3 (Oct 24):
- [ ] **Python bot: Strategy simulator** (3 hours) - Random profit/loss reporting
- [ ] **Python bot: Rebalancing logic** (2 hours) - Withdraw → Bridge → Deposit
- [ ] **Envio config** (2 hours) - Index all vault + strategy events
- [ ] **Run bot in background** (1 hour) - Let it generate activity

**End of Day: Bot is simulating yields and rebalancing. Envio is indexing events.**

---

### Day 4 (Oct 25):
- [ ] **Dashboard UI** (4 hours) - TVL, strategy performance, rebalancing history
- [ ] **Deposit/Withdraw UI** (3 hours) - Forms, wallet connection, transaction flow
- [ ] **Test end-to-end** (1 hour) - Deposit on Arbitrum, bot rebalances to Optimism, withdraw on Base

**End of Day: Working UI, full user flow, bot running in background.**

---

### Day 5 (Oct 26):
- [ ] **Polish UI** (2 hours) - Make it pretty, fix bugs
- [ ] **Record demo video** (2 hours) - 2-minute walkthrough
- [ ] **Write docs** (2 hours) - README, architecture diagram
- [ ] **Practice demo** (1 hour)

**End of Day: Submission-ready.**

---

### Oct 27 (Submission):
- [ ] **Submit at NOON** - Don't wait until 11:59 PM!

---

## 🎯 Key Decisions

| Decision | Recommended | Why |
|----------|-------------|-----|
| **Asset Type** | USDC only | Standard ERC-4626, no swaps/oracles needed |
| **Accounting** | Per-chain | Simple, fast, testable |
| **Strategies** | 3-4 fake strategies | Realistic names, simple implementation |
| **Cross-Chain Sync** | None (bot aggregates in UI) | Avoid Chainlink CCIP complexity |
| **Agent Framework** | None (Python script) | 200 lines vs 2 days learning curve |
| **Rebalancing** | Manual trigger + bot automation | Show both modes in demo |

---

## 🚀 What Makes This Win

### Novel:
- ✅ Cross-chain ERC-4626 with multi-strategy allocation
- ✅ Intent-based rebalancing via Avail Nexus
- ✅ Real-time cross-chain indexing via Envio

### Meaningful Sponsor Integration:
- ✅ **Avail ($4,500):** Core cross-chain bridging for rebalancing
- ✅ **Envio ($5,000):** Real-time indexing of all vault + strategy events across 3 chains

### Technical Depth:
- ✅ Standard ERC-4626 (judges like standards)
- ✅ Multi-strategy allocation (more complex than single-vault)
- ✅ Cross-chain coordination (bot orchestrates 3 chains)

### Working Demo:
- ✅ Deposit USDC on Arbitrum
- ✅ Bot allocates to strategies
- ✅ Bot simulates yields (strategies gain/lose value)
- ✅ Bot rebalances to Optimism (via Avail)
- ✅ Dashboard shows everything in real-time (Envio)
- ✅ Withdraw on Base (different chain!)

**Judges see:** "This is a novel primitive that WORKS."

---

## 📋 Next Steps (RIGHT NOW)

1. **Test Avail SDK** (30 minutes)
   ```bash
   npm install @availproject/nexus-sdk
   # Or: pip install avail-nexus
   # Test: Can you bridge 1 USDC from Arbitrum → Optimism?
   ```

2. **Get USDC on 3 testnets** (1 hour)
   - Circle USDC faucet
   - Or bridge from Sepolia

3. **Clone OpenZeppelin ERC-4626 template** (30 minutes)
   ```bash
   forge init cross-chain-vault
   forge install OpenZeppelin/openzeppelin-contracts
   # Start with: ERC4626.sol
   ```

**If these 3 tasks work: You're good to go. Start building!**

**If Avail SDK fails: Red flag. Consider pivot.**

---

## ✅ Final Checklist

Before you start coding:

- [ ] Avail SDK tested (bridging works)
- [ ] USDC obtained on 3 chains
- [ ] OpenZeppelin ERC-4626 contract ready
- [ ] Architecture clear (per-chain vaults + fake strategies)
- [ ] Timeline realistic (3+1+1 days)
- [ ] Scope locked (NO arbitrage, NO multi-asset, NO agent frameworks)

**If all checked: START CODING NOW!** 🚀

Good luck!

