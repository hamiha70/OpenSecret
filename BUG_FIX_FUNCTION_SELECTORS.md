# 🐛 Critical Bug Fix: Wrong Function Selectors

## Date: 2025-10-24

## 🔍 Bug Discovery

### Symptoms:
- Transaction 37 (`0x477c7a3c886...`) **FAILED** with status "error"
- Blockscout decoded it as `contractOwner()` instead of `requestDeposit(uint256)`
- Polling kept showing "execution reverted"
- Only used 21,570 gas (immediate revert)

### Root Cause:
**ALL function selectors in the frontend were WRONG!** ❌

The code was using incorrect 4-byte function selectors calculated from the wrong function signatures.

## ✅ Fixed Function Selectors

| Function | ❌ OLD (Wrong) | ✅ NEW (Correct) |
|----------|----------------|------------------|
| `requestDeposit(uint256)` | `0xce606ee0` | `0x0d1e6667` |
| `requestRedeem(uint256)` | `0xe3bbb5f1` | `0xaa2f892d` |
| `claimDeposit(address)` | `0x996cba68` | `0xde56603c` |
| `claimRedeem(address)` | `0x2e4f2446` | `0x0c5cb572` |
| `pendingDepositRequest(address)` | `0x6a187c83` | `0xc3702989` |
| `pendingRedeemRequest(address)` | `0xdd93f4a6` | `0x53dc1dd3` |

## 📝 How Selectors Were Calculated

Used Foundry's `cast sig` command:

```bash
cast sig "requestDeposit(uint256)"
# Output: 0x0d1e6667

cast sig "requestRedeem(uint256)"
# Output: 0xaa2f892d

cast sig "claimDeposit(address)"
# Output: 0xde56603c

cast sig "claimRedeem(address)"
# Output: 0x0c5cb572

cast sig "pendingDepositRequest(address)"
# Output: 0xc3702989

cast sig "pendingRedeemRequest(address)"
# Output: 0x53dc1dd3
```

## 🔧 Files Fixed

- `/home/hamiha70/Projects/ETHGlobal/ETHOnline2025/OpenSecret/frontend/app/page.tsx`
  - All 6 function selectors corrected across:
    - `depositToVault()` function
    - `redeemFromVault()` function
    - `pollAndClaimDeposit()` function
    - `pollAndClaimRedeem()` function
    - `checkVaultBalances()` function

## 📊 Impact

### Before Fix:
- ❌ All vault transactions failed
- ❌ Could not read pending deposits/redeems
- ❌ Polling would run forever without success

### After Fix:
- ✅ Transactions should call correct contract functions
- ✅ Pending requests will be readable
- ✅ Auto-claiming will work as designed

## 🧪 Next Steps

1. **Refresh the frontend** (Next.js should hot-reload)
2. **Try deposit again** with the corrected selectors
3. **Monitor MetaMask** for the transaction
4. **Verify on Blockscout** that method is decoded correctly

## 📚 Lessons Learned

**ALWAYS verify function selectors against the actual contract!**

Methods to prevent this:
1. Use `cast sig` to calculate selectors
2. Verify in Blockscout that method name is correct
3. Use ethers.js Contract interface (auto-calculates selectors)
4. Cross-check with contract ABI

## 🎯 Status

- ✅ Bug identified
- ✅ All selectors corrected
- ⏳ Awaiting user test
- 📍 Contract IS verified (Blockscout API confirms `"is_verified": true`)

---

**Note:** The Blockscout UI might show "not verified" due to caching, but the API confirms verification is successful.

