# OmniVault: Final Architecture

**Date:** October 24, 2025  
**Status:** ✅ FINALIZED - Ready to Build  
**Project:** Chain-Agnostic Yield Vault

---

## 🎯 VALUE PROPOSITION

> "One vault. Any chain. Seamless yield. Access high-yield DeFi from Arbitrum, Base, OP, or any chain - earn yield on Sepolia. Powered by Avail Nexus."

**Key Benefits:**
- 🌐 Deposit from ANY chain (no manual bridging)
- ⚡ Fast bridging (~27 seconds via Avail)
- 💸 Low cost (~$0.001 bridge fees)
- 🎯 One-click UX (automated claiming)
- 💰 Earn yield without chain boundaries

---

## 🏗️ ARCHITECTURE

### **System Overview:**

```
┌─────────────────────────────────────────────┐
│  Users on ANY Chain                         │
│  (Arbitrum, Base, OP, Polygon, Sepolia)    │
└────────────────┬────────────────────────────┘
                 │
                 │ Click "Deposit"
                 │
                 ▼
┌─────────────────────────────────────────────┐
│  Avail Nexus Bridge                         │
│  - User-initiated (browser wallet)         │
│  - ~27 seconds execution                    │
│  - ~$0.001 fees                             │
└────────────────┬────────────────────────────┘
                 │
                 │ USDC arrives on Sepolia
                 │
                 ▼
┌─────────────────────────────────────────────┐
│  OmniVault (ERC-7540 on Sepolia)           │
│  ├─ requestDeposit() - Instant              │
│  ├─ [Operator auto-claims]                  │
│  ├─ User receives shares                    │
│  ├─ Vault invests in strategy               │
│  ├─ requestRedeem() - Withdraw              │
│  └─ [Operator auto-claims]                  │
└────────────────┬────────────────────────────┘
                 │
                 │ Optional: Bridge to different chain
                 │
                 ▼
         Avail Nexus (return to any chain)
```

---

## 🔧 TECHNICAL COMPONENTS

### **1. Smart Contracts**

**OmniVault.sol (ERC-7540):**
```solidity
contract OmniVault is ERC7540, ERC4626 {
    // Asset: USDC
    // Chain: Ethereum Sepolia
    
    // Async deposit/redeem
    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);
    function claimDeposit(address receiver, address controller) external returns (uint256 shares);
    
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);
    function claimRedeem(address receiver, address controller) external returns (uint256 assets);
    
    // Operator pattern for UX
    mapping(address => mapping(address => bool)) public operators;
    function setOperator(address operator, bool approved) external;
    function claimDepositFor(address user, uint256 requestId) external;
    function claimRedeemFor(address user, uint256 requestId) external;
    
    // Yield strategy (mock for hackathon)
    function deployToStrategy(uint256 amount) external onlyManager;
}
```

**Strategy (Mock):**
```solidity
contract MockStrategy {
    // Simulates yield generation
    // Returns 5% APY for demo
}
```

### **2. Frontend (Next.js)**

**Key Features:**
```typescript
// Detect user's chain
const userChain = await detectChain();

// Seamless deposit flow
async function deposit(amount: number) {
    // Step 1: Check if on Sepolia
    if (userChain !== SEPOLIA) {
        // Auto-trigger Avail bridge
        await bridgeToSepolia(amount);
    }
    
    // Step 2: Check operator approval (one-time)
    if (!await hasOperator(user)) {
        await approveOperator();
    }
    
    // Step 3: Request deposit
    const requestId = await vault.requestDeposit(amount);
    
    // Step 4: Frontend polls and auto-claims
    await pollAndClaimDeposit(requestId);
    
    // User sees shares!
}
```

**UI Components:**
- Chain selector/detector
- Avail bridge integration (existing)
- Progress indicators
- Balance displays (multi-chain)
- One-click deposit/withdraw

### **3. Operator (Frontend Polling MVP)**

**Phase 1: Frontend Implementation**
```typescript
async function pollAndClaimDeposit(requestId: number) {
    // Show progress to user
    setStatus("Processing deposit (~30 seconds)");
    
    // Poll every 3 seconds
    while (true) {
        const claimable = await vault.pendingDepositRequest(requestId);
        
        if (claimable.assets > 0) {
            // Auto-claim for user
            await vault.claimDeposit(user, requestId);
            setStatus("✅ Deposit complete!");
            break;
        }
        
        await sleep(3000);
    }
}
```

**Phase 2: Backend Bot (If Time Permits)**
```typescript
// Separate service monitoring all pending requests
async function monitorPendingRequests() {
    const pending = await getAllPendingRequests();
    
    for (const request of pending) {
        if (await isClaimable(request.id)) {
            if (await isOperator(request.user)) {
                await vault.claimDepositFor(request.user, request.id);
            }
        }
    }
}
```

---

## 📊 USER FLOWS

### **First-Time User (From Arbitrum):**

```
1. User connects wallet (Arbitrum)
   → Frontend detects: "You're on Arbitrum"

2. User enters amount: "100 USDC"
   → Clicks "Deposit"

3. Avail Bridge Auto-Triggered:
   → "Bridging to Sepolia..." (~27s)
   → User approves in MetaMask
   
4. One-Time Operator Approval:
   → "Enable auto-claiming for seamless UX?"
   → User approves

5. Request Deposit:
   → "Requesting deposit..." (instant)
   → Frontend shows progress bar

6. Auto-Claim (Frontend Polling):
   → "Processing... 15s remaining"
   → "Processing... 5s remaining"
   → "✅ 100 shares received!"

Total: ~30-40 seconds, ONE perceived action
```

### **Returning User (Already on Sepolia):**

```
1. User clicks "Deposit 50 USDC"
2. Request deposit (instant)
3. Frontend auto-polls and claims
4. "✅ 50 shares received!" (~3-5 seconds)

Total: <5 seconds, ONE click
```

### **Withdraw (To Different Chain):**

```
1. User clicks "Withdraw to Arbitrum"
2. Request redeem (instant)
3. Frontend auto-polls and claims USDC on Sepolia
4. User prompted: "Bridge to Arbitrum?"
5. If yes: Avail bridge triggered (~27s)
6. "✅ USDC received on Arbitrum!"

Total: ~30 seconds, feels like ONE action
```

---

## 🎯 KEY DECISIONS

### ✅ **ERC-7540 (Not ERC-4626)**
**Why:** Async design fits Avail's ~27s latency perfectly

### ✅ **Single-Chain Vault (Sepolia Only)**
**Why:** Simpler, faster to build, still achieves cross-chain value prop

### ✅ **Operator Pattern with Frontend Polling**
**Why:** Best UX (one-click), realistic for hackathon timeframe

### ✅ **Avail for User Access (Not LayerZero)**
**Why:** Avail is sponsor, faster, cheaper for user-facing operations

### ❌ **No LayerZero for Vault Management**
**Why:** Not needed, adds complexity, no prize

### ❌ **No Envio Dashboard (For Now)**
**Why:** Focus on core vault first, add if time permits

### ❌ **No Multi-Chain Deployment (For Now)**
**Why:** Prove concept with 1 pool first, expand if time permits

---

## 🏆 PRIZE STRATEGY

### **Primary: Avail Nexus** ($5,000-$10,000)
- ✅ Using Nexus SDK for cross-chain access
- ✅ Novel use case (chain-agnostic vault deposits)
- ✅ Real value proposition
- ✅ Verifiable working demo

### **Secondary: Circle USDC** ($1,000-$2,500)
- ✅ USDC as primary asset
- ✅ Multi-chain support (user deposits from any chain)
- ✅ Demonstrating USDC utility

### **Potential: Blockscout**
- ✅ Used MCP throughout development
- ✅ Transaction verification
- ✅ Multi-chain monitoring

---

## 📝 MESSAGING

### **30-Second Pitch:**
> "DeFi pools are locked to single chains. If you have USDC on Arbitrum but the best yield is on Sepolia, you're stuck. OmniVault solves this: deposit from any chain, earn yield anywhere, withdraw to any chain. Powered by Avail Nexus for seamless ~27-second bridging at $0.001 cost. True chain-agnostic DeFi."

### **Technical Highlight:**
> "ERC-7540 async vault with operator pattern + Avail Nexus intent-based bridging. Users request deposits from any chain, Avail handles the bridge, our operator auto-claims shares. One-click UX with cross-chain reach."

### **Differentiation:**
> "Unlike multi-chain protocols with fragmented liquidity per chain, OmniVault is one vault with multiple entry points. Unified liquidity, chain-agnostic access."

---

## ⏱️ IMPLEMENTATION TIMELINE

### **Phase 1: Core Vault** (3-4 hours)
- [x] Architecture finalized
- [ ] OmniVault.sol (ERC-7540 + Operator)
- [ ] MockStrategy.sol
- [ ] Deployment script
- [ ] Basic tests

### **Phase 2: Frontend Integration** (2-3 hours)
- [ ] Connect to vault contract
- [ ] Operator approval flow
- [ ] Frontend polling for auto-claim
- [ ] Deposit UI with Avail integration
- [ ] Withdraw UI
- [ ] Progress indicators

### **Phase 3: Testing & Polish** (1-2 hours)
- [ ] End-to-end testing
- [ ] UX refinements
- [ ] Documentation
- [ ] Video demo prep

### **Phase 4: Stretch Goals** (If time permits)
- [ ] Backend bot for operator
- [ ] Real yield strategy
- [ ] Second pool on different chain
- [ ] Envio dashboard

**Total MVP: 6-9 hours**

---

## 🔒 SECURITY CONSIDERATIONS

### **Assets Safety:**
- ✅ Assets locked in vault during pending state
- ✅ User can always claim manually (fallback)
- ✅ Operator can only claim (not steal)
- ✅ User can revoke operator anytime

### **Bridge Risk:**
- ✅ Avail has solver network (not single point of failure)
- ✅ User initiates (no automated custody risk)
- ⚠️ Testnet only (limited risk)

---

## 📚 REFERENCE DOCS

- `AVAIL_SUCCESS.md` - Working bridge verification
- `AVAIL_NEXUS_VAULT_ASSESSMENT.md` - Why not use Avail for management
- `ERC7540_UX_SOLUTION.md` - Operator pattern details
- `ARCHITECTURE_DISCUSSION.md` - Full analysis & challenges

---

## ✅ READY TO BUILD

**Confirmed Decisions:**
1. ✅ ERC-7540 async vault
2. ✅ Single-chain (Sepolia)
3. ✅ Operator pattern
4. ✅ Frontend polling MVP
5. ✅ Avail for user access
6. ✅ USDC as asset
7. ✅ No Envio (for now)

**Next Steps:**
1. Write OmniVault.sol
2. Deploy to Sepolia
3. Integrate frontend
4. Test end-to-end

**Estimated Time to Working Demo:** 6-9 hours

---

**Status:** 🚀 **READY TO START BUILDING!**

