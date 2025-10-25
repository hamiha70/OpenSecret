# Pending Request Validation Fix

**Date:** October 25, 2025  
**Issue:** Users could submit multiple requests, wasting gas and causing confusing errors

---

## Problem

The AsyncVault contract enforces **one pending request per user** at a time:

```solidity
function requestDeposit(uint256 assets) external {
    DepositRequest storage existing = pendingDeposits[msg.sender];
    require(existing.assets == 0 || existing.fulfilled, "Pending request exists"); // ❌ Reverts!
    // ...
}
```

However, the frontend **did not validate** this, allowing users to:
1. Click "Deposit" while a deposit is pending → Transaction reverts, gas wasted
2. Get cryptic error message: "Pending request exists"
3. Confusion about why the transaction failed

---

## Solution

### 1. Disable Buttons When Pending Requests Exist

**Deposit Button:**
```typescript
disabled={
  depositProgress !== 'idle' || 
  (!!pendingDeposit && parseFloat(pendingDeposit) > 0)  // ✅ New check
}
```

**Redeem Button:**
```typescript
disabled={
  !vaultShares || 
  parseFloat(vaultShares) === 0 || 
  redeemProgress !== 'idle' || 
  (!!pendingRedeem && parseFloat(pendingRedeem) > 0)  // ✅ New check
}
```

### 2. Show Clear Warning Messages

**When Deposit is Disabled:**
```tsx
{pendingDeposit && parseFloat(pendingDeposit) > 0 ? (
  <p className="text-xs text-amber-600 font-semibold">
    ⚠️ Cannot deposit: You have a pending deposit of {pendingDeposit} USDC waiting to be claimed
  </p>
) : (
  <p className="text-xs text-gray-500">
    Note: This will approve USDC, request deposit, and auto-claim shares
  </p>
)}
```

**When Redeem is Disabled:**
```tsx
{pendingRedeem && parseFloat(pendingRedeem) > 0 ? (
  <p className="text-xs text-amber-600 font-semibold">
    ⚠️ Cannot redeem: You have a pending redeem of {pendingRedeem} shares waiting to be claimed
  </p>
) : (
  <p className="text-xs text-gray-500">
    Note: This will request redeem and auto-claim USDC
  </p>
)}
```

---

## User Experience

### Before (❌):
1. User has 0.1 USDC pending deposit
2. User tries to deposit 0.2 USDC more
3. MetaMask popup appears (gas cost!)
4. Transaction reverts: "Pending request exists"
5. User confused, gas wasted

### After (✅):
1. User has 0.1 USDC pending deposit
2. "Deposit to Vault" button is **grayed out** (disabled)
3. Warning shows: "⚠️ Cannot deposit: You have a pending deposit of 0.100000 USDC waiting to be claimed"
4. User understands they must wait for bot to claim first
5. No gas wasted, clear feedback

---

## Visual Indicator

The disabled button changes from:
```
🟢 [💰 Deposit to Vault]  ← Clickable, green
```

To:
```
⚪ [💰 Deposit to Vault]  ← Grayed out, not clickable
⚠️ Cannot deposit: You have a pending deposit of 0.100000 USDC waiting to be claimed
```

---

## Testing

### Test Case 1: Deposit with Pending Deposit
1. Request deposit of 0.1 USDC
2. **Before bot claims**, try to deposit 0.2 USDC
3. **Expected:** Button disabled, warning shown
4. Wait for bot to claim (or manually claim)
5. Button re-enables, can deposit again

### Test Case 2: Redeem with Pending Redeem
1. Request redeem of 0.1 shares
2. **Before bot claims**, try to redeem 0.2 shares
3. **Expected:** Button disabled, warning shown
4. Wait for bot to claim (or manually claim)
5. Button re-enables, can redeem again

### Test Case 3: Cross-Type Requests (Should Work)
1. Request deposit of 0.1 USDC (pending)
2. Try to redeem 0.1 shares
3. **Expected:** Redeem button **still works** (different type of request)
4. Both requests can be pending simultaneously

---

## Why This Matters

### Gas Savings:
- **Before:** ~$3-5 wasted on failed transaction (mainnet)
- **After:** $0 wasted, transaction never submitted

### UX:
- **Before:** Confusing error, user doesn't know what to do
- **After:** Clear message, user knows to wait

### Contract Compliance:
- **Before:** Frontend allowed invalid actions
- **After:** Frontend enforces same rules as contract

---

## Implementation Details

### Button Disabled Logic:
```typescript
// Deposit button disabled if:
// 1. Currently processing (depositProgress !== 'idle')
// 2. Has pending deposit (pendingDeposit > 0)
disabled={depositProgress !== 'idle' || (!!pendingDeposit && parseFloat(pendingDeposit) > 0)}

// Redeem button disabled if:
// 1. No vault shares
// 2. Currently processing (redeemProgress !== 'idle')
// 3. Has pending redeem (pendingRedeem > 0)
disabled={!vaultShares || parseFloat(vaultShares) === 0 || redeemProgress !== 'idle' || (!!pendingRedeem && parseFloat(pendingRedeem) > 0)}
```

### Warning Message Logic:
```typescript
// Show warning if pendingDeposit exists and is > 0
{pendingDeposit && parseFloat(pendingDeposit) > 0 ? (
  <WarningMessage />
) : (
  <NormalNote />
)}
```

---

## Related Improvements

This fix is part of a broader UX improvement initiative:
1. ✅ **Stale UI fix** - Poll and refresh when bot claims
2. ✅ **Progress tracking** - Show visual progress during multi-step flows
3. ✅ **Input clearing** - Clear fields after submission
4. ✅ **Pending request validation** (this fix)

---

## Ready for Testing! 🎯

Users can now:
- See clear feedback when actions are not allowed
- Understand why buttons are disabled
- Avoid wasting gas on transactions that will fail
- Have confidence in the UI matching contract rules

**No more confusing "Pending request exists" errors!**

