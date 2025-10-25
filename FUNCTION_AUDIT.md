# AsyncVault Function Audit

## ERC-7540 Standard Functions (REQUIRED)

Based on the official ERC-7540 spec, these are **REQUIRED**:

### Request Phase
- ✅ `requestDeposit(uint256 assets, address controller, address owner)` - **We have simplified version with just amount**
- ✅ `requestRedeem(uint256 shares, address controller, address owner)` - **We have simplified version with just shares**
- ❌ `pendingDepositRequest(address controller, address owner)` - **We only have single-address version**
- ❌ `pendingRedeemRequest(address controller, address owner)` - **We only have single-address version**

### Claim Phase  
- ✅ `claimDeposit(address receiver, address controller)` - **We have `claimDeposit()` with msg.sender**
- ✅ `claimRedeem(address receiver, address controller)` - **We have `claimRedeem()` with msg.sender**

### ERC-4626 Base (inherited by ERC-7540)
- ✅ `totalAssets()` - Returns total managed assets
- ✅ `convertToShares(uint256 assets)` - Asset → shares conversion
- ✅ `convertToAssets(uint256 shares)` - Shares → asset conversion
- ✅ `maxDeposit()` / `maxMint()` / `maxWithdraw()` / `maxRedeem()` - **Missing!**
- ✅ `previewDeposit()` / `previewMint()` - **Missing!**
- ✅ `deposit()` / `mint()` / `withdraw()` / `redeem()` - **Should be disabled for async-only**

---

## Our Custom Functions (NOT in ERC-7540)

### 🔴 **Operator Pattern (Custom Addition)**
- `claimDepositFor(address user)` - **NEEDED** for bot automation
- `claimRedeemFor(address user)` - **NEEDED** for bot automation  
- `setOperator(address _operator)` - **NEEDED** for operator management

### 🟡 **Strategy Management (QUESTIONABLE)**
- `strategy` (state variable) - **DO WE NEED THIS?**
- `depositToStrategy(uint256 amount)` - **NOT IMPLEMENTED, REMOVE**
- `setStrategy(address _strategy)` - **PROBABLY REMOVE**

These are **dead code** - we have no strategy deployment in our architecture!

### 🟢 **Profit/Loss Simulation (Custom, but NEEDED)**
- `simulator` (state variable) - **NEEDED** for market bot
- `realizeProfit(address token, uint256 amount)` - **NEEDED** for demo
- `realizeLoss(address token, uint256 amount)` - **NEEDED** for demo
- `setSimulator(address _simulator)` - **NEEDED** for updating bot address

### 🟢 **Reserve Mechanism (ERC-7540 Implementation Detail)**
- `totalReserved` (state variable) - **CRITICAL for ERC-7540 compliance**
- `totalAssetsAvailable()` - **NEEDED** to expose reserved vs available

The reserve mechanism prevents:
1. Race conditions where users redeem more than vault has
2. Underfunding when profit/loss happens between request and claim
3. Front-running by ensuring redemption values are locked

---

## 🎯 Recommendations

### ❌ **REMOVE (Dead Code)**
```solidity
address public strategy;
function depositToStrategy(uint256 amount) external onlyOwner
function setStrategy(address _strategy) external onlyOwner
```
**Reason:** We have NO strategy contracts. This is legacy code from multi-chain design.

### ✅ **KEEP (Essential Custom Functions)**
```solidity
// Operator pattern
address public operator;
function claimDepositFor(address user) external onlyOperator
function claimRedeemFor(address user) external onlyOperator  
function setOperator(address _operator) external onlyOwner

// Market simulation
address public simulator;
function realizeProfit(address token, uint256 amount) external onlySimulator
function realizeLoss(address token, uint256 amount) external onlySimulator
function setSimulator(address _simulator) external onlyOwner

// Reserve mechanism
uint256 public totalReserved;
function totalAssetsAvailable() public view returns (uint256)
```

### 🔄 **REFACTOR (Create Interfaces)**

#### Create `IOperator.sol`
```solidity
interface IOperator {
    function operator() external view returns (address);
    function setOperator(address _operator) external;
    function claimDepositFor(address user) external;
    function claimRedeemFor(address user) external;
}
```

#### Already have `IProfitLossRealizer.sol` ✅

---

## 📊 Function Count Summary

**Total Functions in Contract:** 37
- **ERC-7540 Standard:** ~8 (requestDeposit, requestRedeem, claim functions, pending checks)
- **ERC-4626 Base:** ~15 (totalAssets, convert functions, ERC20 inherited)
- **Operator Pattern (Custom):** 3 (claimFor functions, setOperator)
- **Profit/Loss (Custom):** 3 (realizeProfit, realizeLoss, setSimulator)
- **Strategy (DEAD CODE):** 3 ❌ **REMOVE**
- **Owner/Admin:** 2 (renounceOwnership, transferOwnership - from Ownable)
- **ERC20 Standard:** ~6 (transfer, approve, balanceOf, etc.)

---

## 🚨 Critical Issue: Multi-User Test Failures

You're absolutely right - commenting out tests is **LAZY AND RISKY**.

The failures indicate:
1. **Share calculation bug** - User2 gets 500M shares instead of 1000M
2. **Reserve mechanism edge case** - 3 concurrent redeems fail

These are **NOT edge cases** - they're core multi-user scenarios!

### Root Causes:
1. **Share calculation:** When calculating shares for pending deposits, we subtract `request.assets` from `totalAssets()`, but if there are multiple pending deposits, this creates incorrect share prices.

2. **Reserve mechanism:** The check `totalAssets() - totalReserved >= assets` has an issue with underflow or with how we're tracking reserves across multiple users.

We **MUST** fix these before deployment, not comment them out.

---

## 🎯 Action Plan

1. ✅ **Remove Strategy Functions** (dead code)
2. ✅ **Create IOperator Interface** (clean separation)
3. ✅ **Fix Multi-User Share Calculation Bug**
4. ✅ **Fix Reserve Mechanism for 3+ Users**
5. ✅ **Run Full Test Suite** (ALL 53 tests must pass)
6. ✅ **Then Deploy**

Should I proceed with this plan?

