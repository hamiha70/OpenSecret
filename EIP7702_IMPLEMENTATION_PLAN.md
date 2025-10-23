# EIP-7702 Avail-Native Vault - Implementation Plan

## 🎯 PROJECT: "DelegateVault"

**Tagline:** "The first EIP-7702-powered multi-chain yield vault with Avail integration"

**Core Innovation:** Users delegate their EOA to vault code, enabling smart contract logic while maintaining wallet compatibility for Avail Nexus.

---

## 🏆 Why This WINS:

1. **First EIP-7702 vault EVER** (Pectra just launched!)
2. **Solves Avail browser limitation** (EOA can use Avail, but executes vault logic)
3. **Novel primitive** (single address = wallet + vault)
4. **Perfect sponsor story** (Avail + Envio + Hardhat)
5. **Judge appeal**: Cutting-edge + practical

**Prize Target:** $15K-20K+ (novelty bonus!)

---

## 📋 Implementation Timeline (4.5 Days)

### Day 1 - Afternoon (4 hours remaining)

**Phase 1A: EIP-7702 Proof of Concept** ✅ (Created!)
- [x] Simple test contract
- [x] Test script for AUTH transaction
- [ ] **RUN TEST** - Verify EIP-7702 works on Sepolia
- [ ] Deploy test contract
- [ ] Execute AUTH transaction
- [ ] Verify EOA has delegated code

**Decision Point:**
- ✅ **If works:** Proceed with full implementation
- ❌ **If fails:** Fall back to multi-chain vault (no EIP-7702)

---

### Day 2 (8 hours)

**Phase 1B: Core Vault Contract**
- [ ] `VaultImplementation.sol` (ERC-4626 + EIP-7702 compatible)
  ```solidity
  contract VaultImplementation {
      // Storage layout for EOA context
      mapping(address => UserVault) vaults;
      
      struct UserVault {
          uint256 shares;
          uint256 assets;
          mapping(address => uint256) strategyAllocations;
      }
      
      function deposit(uint256 assets) external returns (uint256 shares);
      function withdraw(uint256 shares) external returns (uint256 assets);
      function allocateToStrategy(address strategy, uint256 amount) external;
      
      // CRITICAL: Avail integration
      function bridgeViaAvail(uint256 toChain, uint256 amount) external {
          // Executes in EOA context
          // Avail sees it as wallet ✅
          // But runs vault logic ✅
      }
  }
  ```

- [ ] Deploy to Arbitrum Sepolia, Optimism Sepolia, Base Sepolia
- [ ] Write deployment scripts
- [ ] Test basic deposit/withdraw

**Phase 1C: Strategy Contracts** (Fake implementations)
- [ ] `IStrategy.sol` interface
- [ ] `UniswapV3Strategy.sol` (mock)
- [ ] `AaveStrategy.sol` (mock)
- [ ] Deploy 2 strategies per chain (6 total)

---

### Day 3 (8 hours)

**Phase 2A: Frontend - EIP-7702 Delegation UI**
- [ ] React app with RainbowKit
- [ ] "Activate Vault" button → Signs AUTH transaction
- [ ] User delegates EOA to VaultImplementation
- [ ] Show "Your wallet is now a vault!" message
- [ ] Dashboard shows vault status

**Phase 2B: Avail Integration**
- [ ] Install `@avail-project/nexus-widgets`
- [ ] Integrate bridge widget
- [ ] Bot recommendation system
  ```javascript
  // Bot analyzes yields
  bot.recommend("Move $500 Arbitrum → Optimism for +4% APY");
  
  // User clicks "Execute via Avail"
  // Widget calls user's EOA
  // EOA executes vault logic via EIP-7702
  // Funds bridge via Avail
  ```

---

### Day 4 (8 hours)

**Phase 3A: Python Bots**
- [ ] `market_simulator.py`
  - Simulates strategy yields
  - Calls `reportProfit()/reportLoss()` on strategies
  - Runs every 5 minutes

- [ ] `investment_analyzer.py`
  - Queries Envio for historic yields
  - Calculates optimal allocations
  - Sends recommendations to UI
  - Triggers Avail bridging (via user approval)

**Phase 3B: Envio Indexing**
- [ ] Setup Envio for 3 chains
- [ ] Index vault events:
  - EIP7702Delegated (user activated vault)
  - Deposit, Withdraw
  - StrategyAllocated
  - AvailBridgeExecuted
  - ProfitReported, LossReported
- [ ] GraphQL queries for bot

---

### Day 5 (6 hours)

**Phase 4: Integration & Polish**
- [ ] End-to-end test:
  1. User delegates EOA
  2. User deposits USDC
  3. Bot detects opportunity on different chain
  4. User approves bridge via Avail
  5. Funds arrive, bot allocates to strategy
  6. User withdraws from any chain

- [ ] Hardhat integration tests
  ```javascript
  describe("EIP-7702 Vault", () => {
    it("Should allow EOA to execute vault logic", async () => {
      // Deploy implementation
      // User signs AUTH
      // Verify EOA has code
      // Call deposit from EOA
      // Verify shares minted
    });
    
    it("Should integrate with Avail for cross-chain", async () => {
      // Test full flow
    });
  });
  ```

- [ ] Demo video (2 min)
- [ ] Documentation
- [ ] Submit by NOON!

---

## 🎬 Demo Script (2 minutes)

**[0:00-0:20] Problem**
> "Avail Nexus only works with browser wallets. Smart contract vaults can't use it. Cross-chain DeFi requires choosing between wallet flexibility OR vault functionality."

**[0:20-0:40] Innovation**
> "We built the first EIP-7702-powered vault. Users delegate their EOA to our vault code. Now their address acts as BOTH a wallet AND a vault."

**[0:40-1:00] Demo - Activation**
> [Screen: UI]
> "I click 'Activate Vault'. This signs an EIP-7702 AUTH transaction, delegating my EOA to vault code. My address is now a smart contract vault!"

**[1:00-1:20] Demo - Deposit & Strategy**
> "I deposit 100 USDC. The vault—my EOA!—mints shares. Our bot monitors yields: Optimism UniV3 = 12%, Arbitrum = 5%. Bot recommends rebalancing."

**[1:20-1:40] Demo - Avail Bridge**
> "I click 'Bridge via Avail'. My EOA interacts with Avail Nexus as a wallet, but executes vault rebalancing logic. Funds move to Optimism, bot allocates to best strategy."

**[1:40-1:55] Demo - Withdraw**
> "Later, I withdraw from any chain. My EOA burns shares, returns USDC plus 7% profit."

**[1:55-2:00] Conclusion**
> "EIP-7702 + Avail + Bot intelligence. A novel primitive for cross-chain DeFi. First of its kind."

---

## 🎖️ Sponsor Integration

### Avail ($4,500)
**Integration:** Tight - EOA vault uses Avail for cross-chain movement
**Story:** "EIP-7702 solves Avail's smart contract limitation"
**Win Probability:** 80% (genuinely novel usage)

### Envio ($5,000)
**Integration:** Core - Multi-chain indexing, bot data source
**Story:** "Envio provides historic yield data for bot decisions"
**Win Probability:** 70% (good multi-chain usage)

### Hardhat ($5,000)
**Integration:** Strong - Testing EIP-7702, integration tests
**Story:** "First Hardhat tests for EIP-7702 contracts"
**Win Probability:** 60% (novel testing scenario)

**Total Expected:** $10.5K (conservative) to $20K+ (optimistic)

---

## ⚠️ Risk Mitigation

### Risk 1: EIP-7702 Doesn't Work on Sepolia Yet
**Probability:** 40%
**Impact:** HIGH (entire architecture fails)
**Mitigation:** Test in next 2 hours! If fails, revert to multi-chain vault

### Risk 2: Avail Doesn't Recognize Delegated EOA
**Probability:** 30%
**Impact:** MEDIUM (can't use Avail, but still have EIP-7702 vault)
**Mitigation:** Test Avail with delegated EOA early (Day 3 morning)

### Risk 3: Time Overrun
**Probability:** 50%
**Impact:** MEDIUM (incomplete features)
**Mitigation:** MVP = EIP-7702 vault + one chain. Skip multi-chain if needed.

---

## ✅ Success Criteria

**Minimum (to submit):**
- [ ] EIP-7702 delegation works
- [ ] User can deposit/withdraw via delegated EOA
- [ ] One strategy works
- [ ] Demo video shows the concept

**Target (for prizes):**
- [ ] Multi-chain (3 chains)
- [ ] Avail integration works
- [ ] Bot provides recommendations
- [ ] Envio indexing operational
- [ ] Integration tests

**Stretch:**
- [ ] Automated rebalancing
- [ ] Beautiful UI
- [ ] Multiple strategies per chain

---

## 🚀 NEXT ACTION

**RIGHT NOW (next 30 minutes):**

1. **Deploy test contract:**
   ```bash
   cd /home/hamiha70/Projects/ETHGlobal/ETHOnline2025/OpenSecret
   # Compile and deploy SimpleVaultLogic.sol
   ```

2. **Run EIP-7702 test:**
   ```bash
   node scripts/test-eip7702.js
   ```

3. **Verify result:**
   - ✅ If works: FULL SPEED AHEAD on EIP-7702 vault
   - ❌ If fails: Pivot to multi-chain vault (no EIP-7702)

**Let's test EIP-7702 NOW!** ⚡

---

**Status:** Ready to test
**Time Spent:** 4 hours (planning + Avail research)
**Time Remaining:** 4.5 days
**Decision Point:** Next 30 minutes determines entire project direction!

