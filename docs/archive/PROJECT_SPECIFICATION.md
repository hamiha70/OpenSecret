# Cross-Chain Multi-Strategy Vault - Complete Project Specification
## ETHOnline 2025 Hackathon Project

**Deadline:** Sunday, October 27, 2025 (5 days remaining)  
**Project Type:** Cross-chain DeFi infrastructure  
**Estimated Prize:** $9,500 - $14,500

---

## 🎯 Project Overview

### Elevator Pitch (30 seconds)

"A cross-chain ERC-4626 vault that automatically allocates capital to the highest-yielding strategies across multiple chains. Users deposit USDC on any chain, and our system intelligently rebalances via Avail Nexus to optimize returns. Single position, multiple chains, automatic optimization."

### Core Innovation

**Novel Primitive:** Cross-chain multi-strategy ERC-4626 vault with intent-based rebalancing.

**What exists today:**
- Single-chain ERC-4626 vaults (Yearn, Rari, etc.)
- Cross-chain bridges (LayerZero, Wormhole, etc.)
- Multi-chain protocols (separate vaults per chain)

**What doesn't exist (your innovation):**
- **Unified cross-chain vault** with intelligent rebalancing
- **Multi-strategy allocation** per chain
- **Intent-based bridging** for capital efficiency

**ETHGlobal precedent:** None found (85% confident it's novel)

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USERS                                   │
│  (Deposit USDC on any chain, withdraw on any chain)        │
└────────┬────────────────────────────────────────────┬───────┘
         │                                            │
    ┌────▼────┐        ┌──────────┐        ┌────────▼────┐
    │Arbitrum │        │Optimism  │        │   Base      │
    │ Vault   │◄──────►│  Vault   │◄──────►│   Vault     │
    └────┬────┘  Avail └─────┬────┘  Avail └──────┬──────┘
         │             Nexus   │             Nexus  │
    ┌────▼────────┐      ┌────▼────────┐      ┌───▼─────────┐
    │ Strategies  │      │ Strategies  │      │ Strategies  │
    │ • Uniswap   │      │ • Uniswap   │      │ • Uniswap   │
    │ • Aave      │      │ • Aave      │      │ • Aave      │
    │ • Compound  │      │ • Compound  │      │ • Compound  │
    │ • Yearn     │      │ • Yearn     │      │ • Yearn     │
    └─────────────┘      └─────────────┘      └─────────────┘
         ▲                      ▲                      ▲
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  Python Bots         │
                    │  • Market Simulator  │
                    │  • Investment Mgr    │
                    └──────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  Envio Indexer       │
                    │  (Real-time tracking)│
                    └──────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  Dashboard UI        │
                    │  (User interface)    │
                    └──────────────────────┘
```

---

## 📦 Components

### 1. Smart Contracts (Solidity)

#### a) CrossChainVault.sol (ERC-4626 Standard)

**Location:** Deployed on Arbitrum Sepolia, Optimism Sepolia, Base Sepolia

**Core Functions:**
```solidity
// Standard ERC-4626 (user-facing)
function deposit(uint256 assets, address receiver) public returns (uint256 shares)
function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares)
function totalAssets() public view returns (uint256)  // Includes all strategy balances

// Custom: Multi-strategy management (owner-only)
function allocateToStrategy(address strategy, uint256 amount) external onlyOwner
function withdrawFromStrategy(address strategy, uint256 amount) external onlyOwner
function addStrategy(address strategy) external onlyOwner
function removeStrategy(address strategy) external onlyOwner
```

**Key Features:**
- Standard ERC-4626 interface (deposit/withdraw/share accounting)
- Per-chain accounting (each vault independent)
- Owner-controlled strategy allocation
- Emits events for Envio indexing

**Inheritance:**
- OpenZeppelin ERC4626
- OpenZeppelin Ownable

**Asset:** Mock USDC (6 decimals)

---

#### b) IStrategy.sol (Interface)

**All strategies implement this interface:**

```solidity
interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balanceOf(address owner) external view returns (uint256);
    function reportProfit(uint256 profit) external;  // Bot calls this
    function reportLoss(uint256 loss) external;      // Bot calls this
    function name() external view returns (string memory);
}
```

---

#### c) Strategy Implementations (Fake)

**4 strategies per chain (12 contracts total):**

1. **UniswapV3Strategy.sol** - Simulates Uniswap V3 LP
2. **AaveStrategy.sol** - Simulates Aave lending
3. **CompoundStrategy.sol** - Simulates Compound lending
4. **YearnStrategy.sol** - Simulates Yearn vault

**Why "fake"?**
- Real Uniswap/Aave integration = 2+ days per protocol
- Fake strategies = same interface, simple implementation
- Judges understand this is a demo (they care about architecture)

**Implementation:**
```solidity
contract UniswapV3Strategy is IStrategy, Ownable {
    IERC20 public immutable usdc;
    address public immutable vault;
    uint256 public balance;
    
    function deposit(uint256 amount) external {
        require(msg.sender == vault, "Only vault");
        usdc.transferFrom(msg.sender, address(this), amount);
        balance += amount;
        emit Deposited(amount);
    }
    
    function withdraw(uint256 amount) external {
        require(msg.sender == vault, "Only vault");
        require(balance >= amount, "Insufficient balance");
        balance -= amount;
        usdc.transfer(vault, amount);
        emit Withdrawn(amount);
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return owner == vault ? balance : 0;
    }
    
    // Bot simulates yields by calling these
    function reportProfit(uint256 profit) external onlyOwner {
        balance += profit;
        emit ProfitReported(profit);
    }
    
    function reportLoss(uint256 loss) external onlyOwner {
        require(balance >= loss, "Loss too high");
        balance -= loss;
        emit LossReported(loss);
    }
    
    function name() external pure returns (string memory) {
        return "Uniswap V3 LP";
    }
}
```

---

#### d) MockUSDC.sol

**Simple ERC-20 with faucet:**

```solidity
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10**6);
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;  // Real USDC has 6 decimals
    }
    
    function faucet() public {
        _mint(msg.sender, 1000 * 10**6);  // 1000 USDC per call
    }
}
```

---

### 2. Off-Chain Bots (Python)

#### a) market_simulator.py

**Purpose:** Simulate real market activity (gains/losses) that doesn't exist on testnets.

**Runs:** Every 5 minutes

**Logic:**
```python
for each chain:
    for each strategy:
        # Random yield: -2% to +5% per 5 min
        yield_rate = random.uniform(-0.02, 0.05)
        
        if yield_rate > 0:
            strategy.reportProfit(balance * yield_rate)
        else:
            strategy.reportLoss(balance * abs(yield_rate))
```

**Output (demo logs):**
```
[arbitrum] Uniswap LP: +3.2% ($320 profit)
[arbitrum] Aave: +1.5% ($150 profit)
[optimism] Uniswap LP: +5.1% ($510 profit) ← Highest!
[base] Compound: -0.8% ($80 loss)
```

---

#### b) investment_manager.py

**Purpose:** Allocate capital to highest-yielding strategies.

**Runs:** Every 10 minutes

**Logic:**
```python
# 1. Get current yields
yields = get_all_strategy_yields()

# 2. Find best strategy per chain
best_arb = max(yields['arbitrum'], key=lambda x: x.yield)
best_opt = max(yields['optimism'], key=lambda x: x.yield)
best_base = max(yields['base'], key=lambda x: x.yield)

# 3. Within-chain rebalancing (if yield diff > 2%)
for chain in chains:
    if yield_difference > 2%:
        vault.withdrawFromStrategy(low_yield_strategy)
        vault.allocateToStrategy(high_yield_strategy)

# 4. Cross-chain rebalancing (if yield diff > 5%)
best_chain = max([best_arb, best_opt, best_base], key=lambda x: x.yield)

for other_chain in chains:
    if best_chain.yield - other_chain.yield > 5%:
        # Withdraw from other_chain
        vault.withdrawFromStrategy(strategies)
        
        # Bridge via Avail
        avail_nexus.bridge(
            from_chain=other_chain,
            to_chain=best_chain,
            amount=withdraw_amount
        )
        
        # Allocate on best_chain
        vault.allocateToStrategy(best_strategy)
```

**Output (demo logs):**
```
📊 Checking allocation...
  arbitrum: Uniswap LP @ 3.2% yield
  optimism: Uniswap LP @ 5.1% yield ← Best!
  base: Aave @ 2.1% yield

→ Cross-chain rebalance (2.9% difference)
  Withdrawing $5,000 from Arbitrum
  🔄 Bridging $5,000 via Avail (Arb → Opt)
  ✅ Allocated to Optimism/Uniswap LP
```

---

### 3. Indexing (Envio)

**Purpose:** Real-time tracking of all vault and strategy events across 3 chains.

**Configuration (envio.config.yaml):**
```yaml
name: cross-chain-vault
networks:
  - id: 421614  # Arbitrum Sepolia
  - id: 11155420  # Optimism Sepolia
  - id: 84532  # Base Sepolia

contracts:
  - name: CrossChainVault
    events:
      - Deposit
      - Withdraw
      - StrategyAllocated
      - StrategyWithdrawn
  
  - name: Strategy
    events:
      - ProfitReported
      - LossReported
```

**GraphQL API Provided:**
```graphql
query TotalTVL {
  vaults {
    chainId
    totalAssets
    totalShares
    sharePrice
  }
}

query StrategyPerformance {
  strategies {
    name
    chainId
    totalProfits
    totalLosses
    currentBalance
  }
}

query RebalancingHistory {
  strategyAllocations(orderBy: timestamp, orderDirection: desc) {
    chainId
    strategy
    amount
    timestamp
  }
}
```

---

### 4. User Interface (React)

**Pages:**

#### a) Dashboard (Home)
- Total TVL across all chains (aggregated)
- TVL breakdown per chain (pie chart)
- Top strategies by yield (table)
- Recent rebalancing events (timeline)

#### b) Deposit
- Connect wallet (MetaMask via RainbowKit)
- Select chain (Arbitrum/Optimism/Base)
- Enter USDC amount
- Show shares received (based on current price)
- Transaction confirmation

#### c) Withdraw
- Show user's shares on each chain
- Select shares to withdraw
- Show USDC amount (including profits)
- Transaction confirmation

#### d) Strategy Performance
- Chart showing strategy yields over time
- Live bot activity log (WebSocket from bots)
- Cross-chain rebalancing events

---

## 📋 Implementation Roadmap

### Day 1 (October 22 - TODAY)

**Morning (4 hours):**
- [ ] Test Avail Nexus SDK (30 min) - GO/NO-GO decision
- [ ] Deploy MockUSDC on all 3 chains (30 min)
- [ ] Write CrossChainVault.sol contract (2 hours)
- [ ] Write Strategy contracts (1 hour)

**Afternoon (4 hours):**
- [ ] Deploy vault + strategies on Arbitrum Sepolia (1 hour)
- [ ] Test deposit/withdraw locally (1 hour)
- [ ] Deploy on Optimism + Base (1 hour)
- [ ] Test cross-chain setup (1 hour)

**Evening:**
- [ ] Verify all contracts on block explorers
- [ ] Test with MetaMask (deposit/withdraw)

**End of Day Goal:** 3 working vaults + 12 strategies deployed

---

### Day 2 (October 23)

**Morning (4 hours):**
- [ ] Write market_simulator.py (2 hours)
- [ ] Test bot locally (connect to contracts) (1 hour)
- [ ] Run bot, verify profits/losses reported (1 hour)

**Afternoon (4 hours):**
- [ ] Write investment_manager.py skeleton (2 hours)
- [ ] Integrate Avail Nexus SDK (or Mock) (1 hour)
- [ ] Test within-chain rebalancing (1 hour)

**Evening:**
- [ ] Test cross-chain rebalancing (Avail bridge)
- [ ] Let both bots run overnight (generate activity)

**End of Day Goal:** Both bots working, strategies showing yields

---

### Day 3 (October 24)

**Morning (4 hours):**
- [ ] Set up Envio config (1 hour)
- [ ] Deploy Envio indexer (1 hour)
- [ ] Test GraphQL queries (1 hour)
- [ ] Verify all events indexed (1 hour)

**Afternoon (4 hours):**
- [ ] Create React app skeleton (1 hour)
- [ ] Build Dashboard page (query Envio) (2 hours)
- [ ] Add RainbowKit wallet connection (1 hour)

**Evening:**
- [ ] Test UI with real data
- [ ] Keep bots running (build up history)

**End of Day Goal:** Dashboard showing live data from Envio

---

### Day 4 (October 25)

**Morning (4 hours):**
- [ ] Build Deposit page (2 hours)
- [ ] Build Withdraw page (2 hours)

**Afternoon (4 hours):**
- [ ] Build Strategy Performance page (2 hours)
- [ ] Add bot activity log (live updates) (1 hour)
- [ ] Polish UI (styling, charts) (1 hour)

**Evening:**
- [ ] End-to-end testing:
  - [ ] User deposits on Arbitrum
  - [ ] Bot rebalances to Optimism
  - [ ] User withdraws on Base
- [ ] Fix bugs

**End of Day Goal:** Full working demo (user flow + bot automation)

---

### Day 5 (October 26)

**Morning (3 hours):**
- [ ] Polish UI (animations, loading states)
- [ ] Add error handling (failed transactions)
- [ ] Test on mobile

**Afternoon (3 hours):**
- [ ] Write README.md (architecture diagram, setup instructions)
- [ ] Record demo video (2 minutes, scripted)
- [ ] Practice demo presentation

**Evening:**
- [ ] Final testing
- [ ] Deploy to Vercel/Netlify
- [ ] Prepare submission

**End of Day Goal:** Submission-ready project

---

### October 27 (Submission Day)

**Morning:**
- [ ] Submit project at NOON (not 11:59 PM!)
- [ ] Double-check all links work
- [ ] Verify demo video uploaded

---

## 🎬 Demo Script (2 minutes)

**[0:00-0:20] Problem Statement**
> "Cross-chain DeFi is fragmented. If you want yield on 3 chains, you need 3 positions, 3 transactions, 3 gas payments. Capital sits idle while you manually rebalance."

**[0:20-0:40] Solution**
> "We built a cross-chain ERC-4626 vault with intelligent rebalancing. Deposit USDC on ANY chain, and our system automatically allocates to the highest-yielding strategies across Arbitrum, Optimism, and Base."

**[0:40-1:00] Live Demo - Deposit**
> [Screen: Dashboard] "Here's our total TVL: $25,000 across 3 chains."
> 
> [Screen: Deposit page] "I'll deposit 100 USDC on Arbitrum. I receive 95.2 shares based on current share price of 1.05."
> 
> [Transaction confirms] "My shares represent proportional ownership of the entire cross-chain vault."

**[1:00-1:20] Live Demo - Strategy Allocation**
> [Screen: Strategy Performance] "Our vault allocates to 4 strategies per chain: Uniswap LP, Aave, Compound, Yearn. Right now, Uniswap LP on Optimism is yielding 5.1%—the highest."

**[1:20-1:40] Live Demo - Cross-Chain Rebalancing**
> [Screen: Bot logs] "Our investment manager bot detects the yield difference and triggers a rebalance."
> 
> [Bot logs show] "Withdrawing $5,000 from Arbitrum... Bridging via Avail Nexus... Allocating to Optimism."
> 
> [Dashboard updates] "The vault now has more capital on Optimism to capture that higher yield."

**[1:40-1:55] Live Demo - Withdraw**
> [Screen: Withdraw page] "Later, I can withdraw on ANY chain—I'll choose Base."
> 
> [Transaction confirms] "I receive 102.5 USDC. A 2.5% profit from cross-chain optimization."

**[1:55-2:00] Technical Highlight**
> "This is powered by Avail Nexus intents for seamless bridging and Envio for real-time indexing across all 3 chains. A novel cross-chain primitive built on ERC-4626 standards."

---

## 🎖️ Sponsor Integration

### Avail ($4,500 Prize Pool)

**Integration Type:** Core - Cross-chain bridging

**How Used:**
- Avail Nexus intents for cross-chain rebalancing
- Bot calls `avail.bridge()` when moving capital between chains
- Seamless UX (no user-facing bridge UI needed)

**Judging Criteria:**
- ✅ Meaningful use (bridging is core to architecture)
- ✅ Novel application (cross-chain vault primitive)
- ✅ Technical depth (intent-based coordination)

**Expected Placement:** Top 3 (if Avail works smoothly)

---

### Envio ($5,000 Prize Pool)

**Integration Type:** Core - Real-time indexing

**How Used:**
- Indexes all vault events (deposits, withdrawals, strategy allocations)
- Indexes all strategy events (profits, losses)
- Powers dashboard with GraphQL API
- Cross-chain aggregation (3 chains → single UI)

**Judging Criteria:**
- ✅ Meaningful use (indexing is essential for UX)
- ✅ Multi-chain (3 chains indexed simultaneously)
- ✅ Real-time (dashboard updates as events occur)

**Expected Placement:** Top 3 (strong integration)

---

### Hardhat ($5,000 Prize Pool - Stretch Goal)

**Integration Type:** Development tooling

**How Used:**
- Contract compilation & deployment
- Unit tests for vault logic
- Integration tests for cross-chain flows
- Gas optimization

**Judging Criteria:**
- ✅ Comprehensive tests (>80% coverage)
- ✅ Well-documented scripts
- ✅ Professional setup

**Expected Placement:** Top 5 (if you write excellent tests)

---

## 💰 Prize Breakdown

| Sponsor | Prize Pool | Your Likelihood | Expected Payout |
|---------|-----------|----------------|-----------------|
| Avail | $4,500 | 60% (if SDK works) | $2,700 |
| Envio | $5,000 | 80% (strong integration) | $4,000 |
| Hardhat | $5,000 | 40% (if great tests) | $2,000 |
| **Total** | **$14,500** | **Average** | **$8,700** |

**Realistic Range:** $5,000 - $10,000  
**Optimistic:** $10,000 - $14,500

---

## 🎯 Success Criteria

### Minimum Viable Demo (must have to submit):
- [ ] Vault deployed on 1+ chains
- [ ] Deposit/withdraw works
- [ ] At least 1 bot running (market simulator)
- [ ] Basic UI (deposit/withdraw page)
- [ ] Demo video (2 min)

### Target Demo (to win prizes):
- [ ] Vaults on 3 chains (Arbitrum, Optimism, Base)
- [ ] 4 strategies per chain (12 total)
- [ ] Both bots running (market sim + investment manager)
- [ ] Cross-chain rebalancing works (Avail or mock)
- [ ] Envio indexing all events
- [ ] Dashboard showing live data
- [ ] Demo video shows full flow
- [ ] Clean code + documentation

### Stretch Goals (if ahead of schedule):
- [ ] Real Avail integration (not mock)
- [ ] Comprehensive tests (Hardhat prize)
- [ ] Beautiful UI (animations, charts)
- [ ] Mobile-responsive
- [ ] Deployment scripts
- [ ] Architecture diagram in README

---

## 🚨 Risk Mitigation

### Risk 1: Avail SDK doesn't work
**Probability:** 40%  
**Impact:** Lose $4,500 prize potential  
**Mitigation:**
- Test in first 30 minutes (GO/NO-GO)
- Have Mock Avail ready as fallback
- Can still win Envio prize ($5K)

### Risk 2: Time overrun
**Probability:** 80%  
**Impact:** Incomplete demo  
**Mitigation:**
- Lock scope (NO feature additions after Day 2)
- Cut Hardhat tests if behind schedule (save 1 day)
- Focus on working demo > perfect code

### Risk 3: Bot bugs during demo
**Probability:** 30%  
**Impact:** Demo looks broken  
**Mitigation:**
- Pre-record bot activity (show logs from yesterday)
- Have manual rebalancing button as backup
- Test demo flow 10+ times

### Risk 4: Faucet/testnet issues
**Probability:** 20%  
**Impact:** Can't test full flow  
**Mitigation:**
- Use Mock USDC (unlimited supply)
- Get testnet ETH on Day 1 (don't wait)
- Have backup wallets ready

---

## 📊 Technical Specifications

### Smart Contracts

**Language:** Solidity ^0.8.20  
**Framework:** Hardhat  
**Testing:** Hardhat (Chai, Ethers.js)  
**Deployment:** Hardhat scripts

**Chains:**
- Arbitrum Sepolia (Chain ID: 421614)
- Optimism Sepolia (Chain ID: 11155420)
- Base Sepolia (Chain ID: 84532)

**Libraries:**
- OpenZeppelin Contracts 5.0
- ERC-4626 (OpenZeppelin implementation)

**Gas Optimization:**
- Use `calldata` for array parameters
- Cache storage reads
- Batch operations where possible

---

### Bots

**Language:** Python 3.10+  
**Libraries:**
- `web3.py` (blockchain interaction)
- `asyncio` (async execution)
- `python-dotenv` (config)
- `avail-nexus-sdk` (if available) or mock

**Execution:**
- Run on local machine during demo
- Could deploy to AWS/Heroku for "production"
- Log output to console (show during demo)

**Configuration:**
```python
# config.py
CHAINS = {
    'arbitrum': {
        'rpc': 'https://sepolia-rollup.arbitrum.io/rpc',
        'chain_id': 421614,
        'vault': '0x...',
        'strategies': ['0x...', ...]
    },
    # ...
}

YIELD_SIMULATION = {
    'interval': 300,  # 5 minutes
    'min_yield': -0.02,  # -2% per interval
    'max_yield': 0.05,   # +5% per interval
}

REBALANCING = {
    'interval': 600,  # 10 minutes
    'min_within_chain_diff': 0.02,  # 2%
    'min_cross_chain_diff': 0.05,   # 5%
}
```

---

### Indexing

**Service:** Envio  
**Type:** Hosted (no self-hosting needed)  
**API:** GraphQL  
**Chains:** 3 (Arbitrum, Optimism, Base)

**Indexed Data:**
- Vault deposits/withdrawals
- Strategy allocations
- Profit/loss reports
- Share prices
- User balances

**Query Performance:**
- Real-time updates (<5 second latency)
- Historical queries (pagination support)
- Aggregations (sum TVL, avg yield, etc.)

---

### Frontend

**Framework:** React 18 + TypeScript  
**Build Tool:** Vite  
**Styling:** Tailwind CSS  
**Charts:** Recharts or Chart.js

**Wallet Connection:** RainbowKit  
**Web3 Library:** wagmi + ethers.js  
**State Management:** React Context or Zustand

**Deployment:** Vercel or Netlify (free tier)

**Pages:**
- `/` - Dashboard
- `/deposit` - Deposit USDC
- `/withdraw` - Withdraw USDC
- `/strategies` - Strategy performance

---

## 🎓 Key Learnings (For Presentation)

**Judge Question:** "Why cross-chain ERC-4626?"

**Your Answer:**
> "Capital efficiency. Today's DeFi is siloed by chain. Users choose a chain and stay there, even if better yields exist elsewhere. Cross-chain vaults unlock composability—one position, optimized globally. This is a primitive that protocols like Yearn could build on."

---

**Judge Question:** "Why not just use Yearn on each chain separately?"

**Your Answer:**
> "You'd need to manually move capital between chains. Our system automates that with intent-based bridging. Plus, unified shares mean simpler accounting for users—one token balance, not three."

---

**Judge Question:** "These strategies are fake, right?"

**Your Answer:**
> "Yes, for the demo. Real integrations would take 2+ days per protocol. Our focus is the novel primitive: cross-chain coordination. On mainnet, we'd plug in real strategies—the interface is the same."

---

**Judge Question:** "How do you prevent the bot from being malicious?"

**Your Answer:**
> "Right now, the bot is trusted (owned by us). For production, we'd either: (a) make the bot logic on-chain (governance-controlled), or (b) use a multi-sig for bot key, or (c) move to fully on-chain rebalancing with Chainlink oracles. For a hackathon demo, centralized automation is acceptable."

---

**Judge Question:** "What's your go-to-market?"

**Your Answer:**
> "This is infrastructure, not a consumer product. Target customers are: (a) DeFi protocols wanting cross-chain vaults, (b) DAOs managing cross-chain treasuries, (c) Institutions needing unified cross-chain exposure. We'd license the primitive or offer it as a service."

---

## ✅ Final Checklist (Before Submission)

### Code:
- [ ] All contracts verified on block explorers
- [ ] README.md with architecture diagram
- [ ] GitHub repo public
- [ ] Code commented (especially complex logic)

### Demo:
- [ ] Demo video uploaded (2 min, <50MB)
- [ ] Live demo URL (frontend deployed)
- [ ] Test live demo from different device
- [ ] Bot logs visible (show automation)

### Documentation:
- [ ] Project description clear (30-second pitch)
- [ ] Architecture explained (diagram + text)
- [ ] Setup instructions (how to run locally)
- [ ] Sponsor integrations explained

### Submission:
- [ ] Submit by NOON Oct 27 (not 11:59 PM)
- [ ] All required fields filled
- [ ] Video link works
- [ ] Demo link works
- [ ] GitHub link works

---

## 📞 Support Resources

**Avail:**
- Discord: https://discord.gg/availproject
- Docs: https://docs.availproject.org/nexus
- GitHub: https://github.com/availproject

**Envio:**
- Discord: https://discord.gg/envio
- Docs: https://docs.envio.dev
- GitHub: https://github.com/enviodev

**ETHOnline:**
- Discord: https://discord.gg/ethglobal
- Mentors: Available in #mentorship-help
- DevPost: https://ethonline2025.devpost.com

---

## 🚀 You've Got This!

**You have:**
- ✅ Novel idea (cross-chain ERC-4626)
- ✅ Clear architecture (vaults + strategies + bots)
- ✅ Locked scope (no feature creep)
- ✅ Realistic timeline (5 days → working demo)
- ✅ Fallback plans (Mock Avail, single-chain pivot)

**Success formula:**
1. Test Avail SDK (30 min) - RIGHT NOW
2. Deploy contracts (Day 1)
3. Build bots (Day 2)
4. Integrate Envio + UI (Day 3-4)
5. Polish + demo (Day 5)
6. Submit EARLY (noon, not midnight)

**Expected result:** $5K-10K in prizes, novel project for portfolio, deep learning experience.

---

**Now stop reading. Start building.** ⏰🚀

