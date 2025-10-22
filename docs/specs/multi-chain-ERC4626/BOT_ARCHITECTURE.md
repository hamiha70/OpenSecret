# Bot Architecture: Market Simulation vs Investment Logic

**Your Question:** Should I have 2 bots, or hardcode investment logic into vault, or use a "steering board"?

**Short Answer:** 2 bots + simple vault functions (owner-controlled). No steering board complexity.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your System                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Smart Contracts (On-Chain)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Vault (Arbitrum, Optimism, Base)                   │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ • deposit() / withdraw() (user-facing)      │    │   │
│  │  │ • allocateToStrategy() (owner only)         │    │   │
│  │  │ • withdrawFromStrategy() (owner only)       │    │   │
│  │  │ • rebalance() (owner only)                  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  Strategies (Fake: Uniswap, Aave, Compound, Yearn)  │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ • deposit() (vault calls)                   │    │   │
│  │  │ • withdraw() (vault calls)                  │    │   │
│  │  │ • reportProfit() (owner only)               │    │   │
│  │  │ • reportLoss() (owner only)                 │    │   │
│  │  │ • balanceOf() (view)                        │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Off-Chain Bots (Python, running on your laptop)           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Bot 1: Market Simulator (every 5 min)             │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ Job: Simulate strategy performance         │     │   │
│  │  │ • Random +/- gains for each strategy       │     │   │
│  │  │ • Call strategy.reportProfit(amount)       │     │   │
│  │  │ • Call strategy.reportLoss(amount)         │     │   │
│  │  │                                            │     │   │
│  │  │ Purpose: Compensate for lack of real       │     │   │
│  │  │ market activity on testnets                │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Bot 2: Investment Manager (every 10 min)          │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ Job: Allocate capital to best strategies  │     │   │
│  │  │ • Read all strategy yields (via balanceOf)│     │   │
│  │  │ • Calculate best strategy per chain        │     │   │
│  │  │ • Withdraw from low-yield strategies       │     │   │
│  │  │ • Deposit into high-yield strategies       │     │   │
│  │  │ • If cross-chain: bridge via Avail         │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Bot 1: Market Simulator

### Purpose
Simulate real market activity (gains/losses) that would exist on mainnet but doesn't exist on testnets.

### What It Does

```python
# market_simulator.py

import asyncio
import random
from web3 import Web3

class MarketSimulator:
    def __init__(self):
        self.chains = ['arbitrum', 'optimism', 'base']
        self.strategies = {
            'arbitrum': [uniswap, aave, compound, yearn],
            'optimism': [uniswap, aave, compound, yearn],
            'base': [uniswap, aave, compound, yearn]
        }
    
    async def simulate_yields(self):
        """Simulate random market gains/losses for each strategy"""
        
        for chain in self.chains:
            for strategy in self.strategies[chain]:
                # Get current strategy balance
                current_balance = strategy.functions.balanceOf(vault_address).call()
                
                if current_balance == 0:
                    continue
                
                # Random yield: -2% to +5% per 5 minutes (annualized: -20% to +50% APY)
                yield_rate = random.uniform(-0.02, 0.05)
                
                if yield_rate > 0:
                    # Profit
                    profit = int(current_balance * yield_rate)
                    tx = strategy.functions.reportProfit(profit).transact({
                        'from': owner_address
                    })
                    print(f"[{chain}] {strategy.name}: +{yield_rate*100:.2f}% (${profit/1e6:.2f})")
                else:
                    # Loss
                    loss = int(current_balance * abs(yield_rate))
                    tx = strategy.functions.reportLoss(loss).transact({
                        'from': owner_address
                    })
                    print(f"[{chain}] {strategy.name}: {yield_rate*100:.2f}% (-${loss/1e6:.2f})")
                
                await asyncio.sleep(1)  # Avoid rate limits
    
    async def run(self):
        """Run simulation loop"""
        print("🎲 Market Simulator Started")
        
        while True:
            await self.simulate_yields()
            await asyncio.sleep(300)  # Every 5 minutes

# Usage
simulator = MarketSimulator()
asyncio.run(simulator.run())
```

### Configuration

```python
# config.py

YIELD_PROFILES = {
    'uniswap_lp': {
        'min_yield': 0.0,   # 0% per 5 min
        'max_yield': 0.08,  # 8% per 5 min (very volatile)
        'description': 'High risk, high reward'
    },
    'aave_lending': {
        'min_yield': 0.01,  # 1% per 5 min
        'max_yield': 0.04,  # 4% per 5 min (stable)
        'description': 'Low risk, steady yield'
    },
    'compound': {
        'min_yield': 0.005, # 0.5% per 5 min
        'max_yield': 0.035, # 3.5% per 5 min (moderate)
        'description': 'Medium risk, medium reward'
    },
    'yearn': {
        'min_yield': 0.02,  # 2% per 5 min
        'max_yield': 0.06,  # 6% per 5 min (high yield)
        'description': 'Auto-optimizing strategies'
    }
}
```

**Why This Works for Demo:**
- Creates realistic "market activity"
- Shows strategies have different yields
- Justifies rebalancing (Investment Manager bot can optimize)

---

## Bot 2: Investment Manager

### Purpose
Allocate vault capital to the highest-yielding strategies across all chains.

### What It Does

```python
# investment_manager.py

import asyncio
from web3 import Web3
from avail_nexus import NexusClient

class InvestmentManager:
    def __init__(self):
        self.chains = ['arbitrum', 'optimism', 'base']
        self.vaults = {...}  # Vault contract instances
        self.strategies = {...}  # Strategy contract instances
        self.nexus = NexusClient()
    
    async def get_strategy_yields(self):
        """Calculate current yield for each strategy"""
        yields = {}
        
        for chain in self.chains:
            yields[chain] = {}
            for strategy_name, strategy in self.strategies[chain].items():
                # Get strategy balance
                balance = strategy.functions.balanceOf(vault_address).call()
                
                # Get historical balance (stored in bot memory or on-chain)
                prev_balance = self.get_previous_balance(chain, strategy_name)
                
                # Calculate yield (% gain since last check)
                if prev_balance > 0:
                    yield_pct = ((balance - prev_balance) / prev_balance) * 100
                else:
                    yield_pct = 0
                
                yields[chain][strategy_name] = {
                    'balance': balance,
                    'yield': yield_pct,
                    'address': strategy.address
                }
        
        return yields
    
    async def find_best_allocation(self, yields):
        """Determine optimal allocation"""
        # Find best strategy per chain
        best_per_chain = {}
        for chain, strategies in yields.items():
            best_strategy = max(strategies.items(), key=lambda x: x[1]['yield'])
            best_per_chain[chain] = {
                'strategy': best_strategy[0],
                'yield': best_strategy[1]['yield'],
                'balance': best_strategy[1]['balance']
            }
        
        # Find global best chain
        best_chain = max(best_per_chain.items(), key=lambda x: x[1]['yield'])
        
        return best_per_chain, best_chain
    
    async def rebalance_within_chain(self, chain, target_strategy):
        """Move funds from low-yield to high-yield strategies on same chain"""
        vault = self.vaults[chain]
        
        # Withdraw from all strategies except target
        for strategy_name, strategy in self.strategies[chain].items():
            if strategy_name == target_strategy:
                continue
            
            balance = strategy.functions.balanceOf(vault_address).call()
            if balance > 0:
                print(f"  Withdrawing ${balance/1e6:.2f} from {strategy_name}")
                tx = vault.functions.withdrawFromStrategy(
                    strategy.address,
                    balance
                ).transact({'from': owner_address})
        
        # Get total idle capital
        idle_usdc = usdc.functions.balanceOf(vault.address).call()
        
        # Allocate all to target strategy
        if idle_usdc > 0:
            print(f"  Allocating ${idle_usdc/1e6:.2f} to {target_strategy}")
            target = self.strategies[chain][target_strategy]
            tx = vault.functions.allocateToStrategy(
                target.address,
                idle_usdc
            ).transact({'from': owner_address})
    
    async def rebalance_across_chains(self, from_chain, to_chain, amount):
        """Move funds from one chain to another via Avail"""
        print(f"🔄 Cross-Chain Rebalance: {from_chain} → {to_chain} (${amount/1e6:.2f})")
        
        # 1. Withdraw from source chain strategies
        from_vault = self.vaults[from_chain]
        total_withdrawn = 0
        for strategy in self.strategies[from_chain].values():
            balance = strategy.functions.balanceOf(vault_address).call()
            if balance > 0 and total_withdrawn < amount:
                withdraw_amount = min(balance, amount - total_withdrawn)
                tx = from_vault.functions.withdrawFromStrategy(
                    strategy.address,
                    withdraw_amount
                ).transact({'from': owner_address})
                total_withdrawn += withdraw_amount
        
        # 2. Bridge via Avail Nexus
        print(f"  Bridging ${total_withdrawn/1e6:.2f} via Avail...")
        tx = await self.nexus.bridge(
            from_chain=chain_ids[from_chain],
            to_chain=chain_ids[to_chain],
            amount=total_withdrawn,
            asset='USDC'
        )
        await tx.wait()
        
        # 3. Wait for bridge completion
        await asyncio.sleep(60)  # Avail bridges take ~1 min
        
        # 4. Allocate on target chain
        to_vault = self.vaults[to_chain]
        best_strategy = await self.find_best_strategy(to_chain)
        
        tx = to_vault.functions.allocateToStrategy(
            best_strategy.address,
            total_withdrawn
        ).transact({'from': owner_address})
        
        print(f"  ✅ Rebalanced to {to_chain}/{best_strategy.name}")
    
    async def optimize(self):
        """Main optimization logic"""
        print("\n📊 Checking allocation...")
        
        # Get current yields
        yields = await self.get_strategy_yields()
        
        # Find best allocation
        best_per_chain, (best_chain_name, best_chain_data) = await self.find_best_allocation(yields)
        
        # Print current state
        for chain, data in best_per_chain.items():
            print(f"  {chain}: {data['strategy']} @ {data['yield']:.2f}% yield")
        
        # Decision: Rebalance within chain or across chains?
        
        # Rule 1: Within-chain rebalancing (if yield difference > 2%)
        for chain, strategies in yields.items():
            best = best_per_chain[chain]
            for strategy_name, data in strategies.items():
                if strategy_name != best['strategy']:
                    yield_diff = best['yield'] - data['yield']
                    if yield_diff > 2.0 and data['balance'] > 0:
                        print(f"  → Rebalancing within {chain} ({yield_diff:.2f}% difference)")
                        await self.rebalance_within_chain(chain, best['strategy'])
                        break
        
        # Rule 2: Cross-chain rebalancing (if yield difference > 5%)
        for chain, data in best_per_chain.items():
            if chain == best_chain_name:
                continue
            
            yield_diff = best_chain_data['yield'] - data['yield']
            if yield_diff > 5.0:
                # Calculate amount to move (50% of source chain TVL)
                source_tvl = sum(s['balance'] for s in yields[chain].values())
                move_amount = source_tvl // 2
                
                if move_amount > 1_000_000:  # At least $1 to move
                    print(f"  → Cross-chain rebalance ({yield_diff:.2f}% difference)")
                    await self.rebalance_across_chains(chain, best_chain_name, move_amount)
    
    async def run(self):
        """Run optimization loop"""
        print("🤖 Investment Manager Started")
        
        while True:
            try:
                await self.optimize()
            except Exception as e:
                print(f"❌ Error: {e}")
            
            await asyncio.sleep(600)  # Every 10 minutes

# Usage
manager = InvestmentManager()
asyncio.run(manager.run())
```

---

## Why NOT Hardcode Investment Logic in Vault?

**Your Question:** "Maybe better to hardcode this into the vault?"

**Answer: NO. Keep vault simple, bot handles logic.**

### Problems with On-Chain Investment Logic

| On-Chain Logic | Off-Chain Bot (Recommended) |
|----------------|------------------------------|
| 🔴 Gas costs for every decision | ✅ Free computation off-chain |
| 🔴 Limited computation (gas limits) | ✅ Unlimited computation |
| 🔴 Hard to update logic (need contract upgrade) | ✅ Easy to update (edit Python script) |
| 🔴 Can't access off-chain data easily | ✅ Can query Envio, APIs, etc. |
| 🔴 Complex to test | ✅ Easy to test locally |

### What SHOULD Be in Vault Contract

```solidity
// Vault.sol - SIMPLE owner-controlled functions

function allocateToStrategy(address strategy, uint256 amount) external onlyOwner {
    require(strategies[strategy], "Invalid strategy");
    IERC20(asset).transfer(strategy, amount);
    IStrategy(strategy).deposit(amount);
    emit StrategyAllocated(strategy, amount);
}

function withdrawFromStrategy(address strategy, uint256 amount) external onlyOwner {
    require(strategies[strategy], "Invalid strategy");
    IStrategy(strategy).withdraw(amount);
    emit StrategyWithdrawn(strategy, amount);
}

// NO complex logic here!
// Bot decides WHEN to call these functions
```

**Why This is Better:**
- ✅ Vault is a "dumb" capital pool (easy to audit, low gas)
- ✅ Bot is the "smart" manager (complex logic, free computation)
- ✅ Clear separation of concerns
- ✅ Judges understand this pattern (Yearn, Rari, etc. all do this)

---

## Why NOT a "Steering Board"?

**Your Question:** "Or have a steering board which allows investment/harvest calls?"

**Answer: Too complex for 5 days. Not worth it.**

### What is a Steering Board?

Governance system where multiple parties vote on investment decisions.

**Example:**
```solidity
contract SteeringBoard {
    mapping(address => bool) public board members;
    mapping(bytes32 => uint256) public votes;
    
    function proposeAllocation(address strategy, uint256 amount) external {
        // Create proposal
    }
    
    function vote(bytes32 proposalId, bool support) external {
        // Board members vote
    }
    
    function executeIfPassed(bytes32 proposalId) external {
        // Execute if majority votes yes
    }
}
```

### Why NOT Do This?

| Steering Board | Owner-Controlled (Recommended) |
|----------------|--------------------------------|
| 🔴 Complex: 3-5 days to build | ✅ Simple: 30 minutes |
| 🔴 Not novel (many DAO examples) | ✅ Novel part is cross-chain vault, not governance |
| 🔴 Slows down demo (need to show voting) | ✅ Fast demo (bot just rebalances) |
| 🔴 Adds attack surface (governance exploits) | ✅ Centralized = simple (OK for hackathon) |

**When to use Steering Board:**
- ✅ If you're building a DAO protocol (governance is the point)
- ✅ If you have 2+ weeks
- ❌ For a 5-day cross-chain vault demo (overkill)

---

## Recommended Architecture (Final)

```
Smart Contracts (On-Chain):
  ├── Vault.sol
  │   ├── deposit() / withdraw() [user-facing, standard ERC-4626]
  │   ├── allocateToStrategy() [owner only, simple transfer]
  │   ├── withdrawFromStrategy() [owner only, simple call]
  │   └── totalAssets() [view, sums strategy balances]
  │
  ├── Strategy.sol (interface)
  │   ├── deposit() [vault calls]
  │   ├── withdraw() [vault calls]
  │   ├── reportProfit() [owner only, bot calls]
  │   ├── reportLoss() [owner only, bot calls]
  │   └── balanceOf() [view]

Off-Chain Bots (Python):
  ├── market_simulator.py
  │   └── Every 5 min: Call reportProfit/Loss on strategies
  │
  └── investment_manager.py
      └── Every 10 min:
          ├── Read strategy yields
          ├── Calculate best allocation
          ├── Call vault.withdrawFromStrategy (low yield)
          ├── Bridge via Avail (if cross-chain)
          └── Call vault.allocateToStrategy (high yield)
```

**Why This Works:**
- ✅ Simple contracts (easy to audit, low gas)
- ✅ Complex logic in bots (flexible, testable)
- ✅ Clear separation (vault = capital pool, bot = manager)
- ✅ Standard pattern (Yearn, Enzyme, etc.)
- ✅ Easy to demo (bot runs in background, logs show rebalancing)

---

## Demo Flow

**Minute 0:** Start both bots
```
🎲 Market Simulator Started
🤖 Investment Manager Started
```

**Minute 0-5:** Market Simulator runs
```
[arbitrum] Uniswap LP: +3.2% ($320)
[arbitrum] Aave: +1.5% ($150)
[optimism] Uniswap LP: +5.1% ($510)  ← Best!
[optimism] Aave: +2.3% ($230)
```

**Minute 10:** Investment Manager rebalances
```
📊 Checking allocation...
  arbitrum: Uniswap LP @ 3.2% yield
  optimism: Uniswap LP @ 5.1% yield  ← Best!
  → Cross-chain rebalance (1.9% difference)
  Withdrawing $5,000 from Arbitrum strategies
  Bridging $5,000 via Avail...
  ✅ Rebalanced to optimism/Uniswap LP
```

**Judges see:** "This bot is intelligently managing capital across chains!" 🎉

---

## Final Answer to Your Questions

### Q: "Will have 2 bots: market simulation + investment. Is this right?"

✅ **YES. This is the perfect architecture.**

- Bot 1 (Market Simulator): Creates fake yields (compensates for testnet lack of activity)
- Bot 2 (Investment Manager): Optimizes allocation based on yields

### Q: "Or hardcode into vault?"

❌ **NO. Keep vault simple (owner-controlled functions only).**

- Vault = dumb capital pool
- Bot = smart manager
- Standard pattern, judges expect this

### Q: "Or have a steering board?"

❌ **NO. Too complex for 5 days, not worth it.**

- Steering board = 3-5 days of work
- Adds complexity, not novelty
- Owner-controlled is fine for hackathon demo

---

## Implementation Checklist

- [ ] Vault has simple owner functions (allocate, withdraw)
- [ ] Bot 1: Market Simulator (random yields every 5 min)
- [ ] Bot 2: Investment Manager (optimize every 10 min)
- [ ] Both bots run in background during demo
- [ ] Both bots log actions (show in terminal during demo)
- [ ] NO steering board, NO on-chain logic complexity

**Time estimate:** 1 day for both bots (4 hours each)

---

**Your architecture is spot-on. Build it as you described: 2 bots, simple vault functions, no steering board.** ✅

