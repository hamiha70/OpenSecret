# Critical: Inheritance Architecture Issue

## The Problem You Identified

**Current (WRONG):**
```solidity
contract AsyncVault is ERC20, Ownable, IOperator, IProfitLossRealizer
```

We're **skipping ERC4626** entirely and reimplementing everything from scratch!

**Should Be:**
```solidity
contract AsyncVault is ERC4626, Ownable, IOperator, IProfitLossRealizer
```

Where `ERC4626` already extends `ERC20` and provides:
- ✅ `totalAssets()`
- ✅ `convertToShares()`  
- ✅ `convertToAssets()`
- ✅ `maxDeposit()` / `maxMint()` / `maxWithdraw()` / `maxRedeem()`
- ✅ `previewDeposit()` / `previewMint()` / `previewWithdraw()` / `previewRedeem()`
- ✅ `deposit()` / `mint()` / `withdraw()` / `redeem()`
- ✅ Proper share/asset math with rounding

## What We're Currently Doing (Bad)

We manually implemented:
- `totalAssets()` - ✅ We have this
- `convertToShares()` - ✅ We have this
- `convertToAssets()` - ✅ We have this
- `maxDeposit()` - ❌ Missing
- `maxMint()` - ❌ Missing
- `previewDeposit()` - ❌ Missing
- `deposit()` - ❌ Missing (we only have requestDeposit)
- `mint()` - ❌ Missing

This means:
1. **We're reinventing the wheel** (badly)
2. **Missing standard functions** that ERC4626 provides
3. **Potential bugs** in share math that OpenZeppelin already solved
4. **Less confidence** from auditors/judges

## Why This Happened

Looking at our contract history, we:
1. Started with a simple vault concept
2. Added ERC-7540 async pattern on top
3. Never refactored to use the standard ERC4626 base

## The Right Architecture

### Standard Stack:
```
┌─────────────────────────┐
│    AsyncVault (our)     │  ← ERC-7540 async logic
│  - requestDeposit()     │     + Custom operator pattern
│  - requestRedeem()      │     + Custom profit/loss
│  - claimDeposit()       │
│  - claimRedeem()        │
└───────────┬─────────────┘
            │ extends
┌───────────▼─────────────┐
│  ERC4626 (OpenZeppelin) │  ← Vault standard
│  - deposit()            │
│  - withdraw()           │
│  - totalAssets()        │
│  - convertTo*()         │
│  - preview*()           │
└───────────┬─────────────┘
            │ extends
┌───────────▼─────────────┐
│   ERC20 (OpenZeppelin)  │  ← Token standard
│  - transfer()           │
│  - balanceOf()          │
│  - approve()            │
└─────────────────────────┘
```

## Benefits of Using ERC4626

1. **Tested & Audited** - OpenZeppelin's code is battle-tested
2. **Standard Compliant** - Works with all ERC4626 tooling
3. **Correct Math** - Rounding modes are tricky, OZ got it right
4. **Less Code** - We can delete our manual implementations
5. **Judge Confidence** - "Built on OpenZeppelin" is a strong statement

## The Challenge: ERC-7540 + ERC-4626

ERC-7540 **extends** ERC-4626 but makes some functions async:

**ERC-4626 (synchronous):**
- `deposit()` → immediate shares
- `redeem()` → immediate assets

**ERC-7540 (asynchronous):**
- `requestDeposit()` → pending
- `claimDeposit()` → get shares later
- `requestRedeem()` → pending  
- `claimRedeem()` → get assets later

### How to Handle Both?

**Option A: Disable sync functions**
```solidity
function deposit(...) public override returns (uint256) {
    revert("Use requestDeposit");
}
```

**Option B: Support both (complex)**
```solidity
// Sync path (immediate if liquidity available)
function deposit(...) public override returns (uint256) {...}

// Async path (always available)
function requestDeposit(...) public returns (uint256) {...}
```

**Recommendation: Option A** for hackathon simplicity

## Current Functions We're Duplicating

From OpenZeppelin ERC4626 that we should be using:

```solidity
// We manually implemented these (should inherit):
function totalAssets() public view virtual returns (uint256)
function convertToShares(uint256 assets) public view virtual returns (uint256)
function convertToAssets(uint256 shares) public view virtual returns (uint256)

// We're missing these (ERC4626 provides):
function maxDeposit(address) public view virtual returns (uint256)
function maxMint(address) public view virtual returns (uint256)
function maxWithdraw(address owner) public view virtual returns (uint256)
function maxRedeem(address owner) public view virtual returns (uint256)
function previewDeposit(uint256 assets) public view virtual returns (uint256)
function previewMint(uint256 shares) public view virtual returns (uint256)
function previewWithdraw(uint256 assets) public view virtual returns (uint256)
function previewRedeem(uint256 shares) public view virtual returns (uint256)
```

## Decision Point

### Do we refactor NOW or LATER?

**Refactor NOW:**
- ✅ Proper architecture
- ✅ Judge confidence  
- ✅ Standard compliance
- ❌ Risk of breaking working code
- ❌ More testing needed
- ❌ Time pressure

**Refactor LATER (after hackathon):**
- ✅ Lower risk
- ✅ Can deploy current version
- ✅ Still demo-able
- ❌ Non-standard for judging
- ❌ Technical debt

## My Recommendation

Given that we have **4 failing tests already**, I suggest:

**Phase 1: NOW (Get Working)**
1. Fix the 4 failing multi-user tests with current architecture
2. Rename simulator → profitLossProvider  
3. Deploy and demo

**Phase 2: BEFORE JUDGING (Get Compliant)**
1. Refactor to inherit from ERC4626
2. Disable sync deposit/redeem functions
3. Add comprehensive tests
4. Redeploy
5. Update docs to emphasize "ERC4626 + ERC7540 compliant"

This gives you:
- ✅ Working demo ASAP
- ✅ Standards compliance for final submission
- ✅ Lower risk (fix tests first, refactor second)

**What do you think? Should we:**
A) Fix tests first, refactor to ERC4626 later?
B) Refactor to ERC4626 now (riskier but cleaner)?

