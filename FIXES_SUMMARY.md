# 🔧 Critical Fixes Applied

## Issue 1: Market Simulator Using OLD Vault Address ❌

**Problem:**
```
to: '0xf286AE673A1a78bFb1FE1b5A24634FFdDDb815AA'  ← OLD FAILED DEPLOYMENT
execution reverted (no data present; likely require(false) occurred
```

**Root Cause:**
Next.js caches server-side environment variables. Restarting via UI toggles does NOT reload `.env.local`!

**Fix:**
1. Added `VAULT_ADDRESS` to root `.env`
2. Cleared Next.js cache: `rm -rf .next/cache`
3. Must kill and restart Next.js dev server to pick up new env vars

---

## Issue 2: Empty Vault Blocking Seed Capital ❌

**Problem:**
```
[Market Simulator] ⚠️  Vault balance is 0, skipping simulation
```

**Issue:**
Market simulator couldn't add initial capital because it skipped on zero balance!

**Fix:**
Updated `frontend/app/api/market-simulator/route.ts`:
- Zero balance now triggers **seed capital addition** (10 USDC)
- Transfers USDC to vault
- Emits `ProfitRealized` event for indexer
- No longer skips - allows vault to bootstrap itself!

```typescript
if (totalAssets === 0) {
  console.log('[Market Simulator] 💰 Vault balance is 0, adding seed capital...')
  const seedAmount = ethers.parseUnits('10', 6) // 10 USDC seed
  await usdc.transfer(VAULT_ADDRESS, seedAmount, { gasLimit: 100000 })
  await vault.realizeProfit(seedAmount, { gasLimit: 100000 })
  console.log(`[Market Simulator] ✅ Added 10 USDC seed capital to vault`)
}
```

---

## Issue 3: Operator Bot ABI Mismatch ⚠️

**Problem:**
```
code: 'BAD_DATA',
info: { method: 'operator', signature: 'operator()' },
shortMessage: 'could not decode result data'
```

**Likely Cause:**
ABI missing `operator()` function or using cached/outdated ABI.

**To Verify:**
```bash
cd contracts-foundry
forge inspect AsyncVault abi > ../frontend/config/AsyncVault.abi.json
```

---

## ✅ How to Restart Properly

**Current Config (Arbitrum Sepolia):**
```bash
VAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME="Arbitrum Sepolia"
```

**Restart Commands:**
```bash
# Kill all Next.js processes
pkill -9 -f "next dev"

# Clear cache
cd frontend
rm -rf .next/cache

# Restart frontend
npm run dev

# In another terminal, restart operator bot
cd operator-bot
npm start
```

---

## 🎯 Expected Behavior After Fix

**Market Simulator:**
```
[Market Simulator] Connected to arbitrum-sepolia (Chain 421614)
[Market Simulator] 💰 Vault balance is 0, adding seed capital...
[Market Simulator] ✅ Added 10 USDC seed capital to vault
[Market Simulator] 📈 Emitted ProfitRealized event
```

**Operator Bot:**
```
📍 Vault:    0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
🔗 Chain:    arbitrum-sepolia (421614)
👤 Operator: 0x36AB...51Ba
✅ Operator bot initialized successfully
```

**NO MORE:**
- ❌ `0xf286AE673A1a78bFb1FE1b5A24634FFdDDb815AA`
- ❌ `execution reverted (no data present)`
- ❌ `Vault balance is 0, skipping simulation`

---

## 📝 Key Lessons

1. **Next.js env var caching:** UI restart ≠ env reload. Must kill process + clear cache.
2. **Bootstrap logic:** Market simulator should be able to seed empty vaults.
3. **ABI sync:** Always regenerate ABI after contract changes.
4. **Single source of truth:** All services now read from `.env` / `.env.local`.

---

**Date:** October 26, 2025
**Vault:** AsyncVault v5 on Arbitrum Sepolia
**Address:** `0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09`
