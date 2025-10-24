# 🔍 Debugging Guide - OmniVault

## Critical Bug Fixed: Wrong Function Selectors

### What We Found:
All 6 function selectors in `frontend/app/page.tsx` were **INCORRECT**, causing all vault transactions to fail.

### How We Discovered It:
1. Transaction failed on Sepolia
2. Blockscout showed wrong method name: `contractOwner()` instead of `requestDeposit(uint256)`
3. Transaction reverted immediately (21,570 gas used = instant revert)
4. Used `cast sig` to calculate correct selectors

### The Fix:
All function selectors have been corrected. See `BUG_FIX_FUNCTION_SELECTORS.md` for details.

---

## Common Issues & Solutions

### 1. Transaction Shows Wrong Method Name on Blockscout
**Symptom:** Blockscout decodes your transaction as a different function

**Cause:** Wrong 4-byte function selector

**Solution:**
```bash
cd contracts-foundry
cast sig "functionName(type1,type2)"
```

### 2. Transaction Fails with "execution reverted"
**Check:**
- ✅ Is the function selector correct?
- ✅ Are the parameters encoded correctly?
- ✅ Does the user have sufficient token balance?
- ✅ Has the user approved the contract?
- ✅ Is the gas limit sufficient?

### 3. MetaMask Shows "Transaction Likely to Fail"
**Causes:**
- Wrong function selector
- Insufficient gas
- Contract revert (check require statements)
- Wrong parameter encoding

### 4. Polling Never Completes
**Check:**
- Are the view function selectors correct?
- Is the contract in the expected state?
- Use Blockscout to verify pending request was created

### 5. Contract Appears "Not Verified" on Blockscout UI
**Solution:** Check via Blockscout API:
```bash
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC 0x1b1870ac9f024d57Bd0670Ba2898CA4ef35eBfbe "name()(string)"
```
If it returns "OmniVault", the contract IS verified (UI cache issue)

---

## Debugging Workflow

### Step 1: Check Transaction on Blockscout
1. Copy transaction hash from MetaMask or logs
2. Go to: `https://eth-sepolia.blockscout.com/tx/HASH`
3. Check:
   - Status (success/error)
   - Method name (is it correct?)
   - Gas used (low gas = immediate revert)
   - Revert reason (if available)

### Step 2: Verify Function Selector
```bash
cd contracts-foundry
cast sig "yourFunction(types)"
```
Compare with what's in `frontend/app/page.tsx`

### Step 3: Check Contract State
```bash
# Check if user has pending deposit
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC \
  0x1b1870ac9f024d57Bd0670Ba2898CA4ef35eBfbe \
  "pendingDepositRequest(address)(uint256,uint48,bool)" \
  YOUR_ADDRESS
```

### Step 4: Simulate Transaction
```bash
# Test if transaction would succeed (eth_call)
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC \
  --from YOUR_ADDRESS \
  0x1b1870ac9f024d57Bd0670Ba2898CA4ef35eBfbe \
  "requestDeposit(uint256)" \
  1000000  # 1 USDC in wei (6 decimals)
```

---

## Parameter Encoding Reference

### uint256 (256-bit unsigned integer)
Must be 64 hex characters (32 bytes), padded with zeros:
```javascript
const amount = 1000000 // 1 USDC (6 decimals)
const hex = amount.toString(16).padStart(64, '0')
// Result: "00000000000000000000000000000000000000000000000000000000000f4240"
```

### address (160-bit Ethereum address)
Must be 64 hex characters, padded:
```javascript
const addr = "0x36AB88fDd34848C0caF4599736a9D3a860D051Ba"
const hex = "000000000000000000000000" + addr.slice(2).toLowerCase()
// Result: "00000000000000000000000036ab88fdd34848c0caf4599736a9d3a860d051ba"
```

### Complete Transaction Data
```javascript
const functionSelector = "0x0d1e6667" // requestDeposit(uint256)
const amountParam = "00000000000000000000000000000000000000000000000000000000000f4240"
const data = functionSelector + amountParam
// Result: "0x0d1e666700000000000000000000000000000000000000000000000000000000000f4240"
```

---

## Useful Commands

### Check USDC Balance
```bash
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC \
  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  "balanceOf(address)(uint256)" \
  YOUR_ADDRESS
```

### Check USDC Allowance
```bash
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC \
  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  "allowance(address,address)(uint256)" \
  YOUR_ADDRESS \
  0x1b1870ac9f024d57Bd0670Ba2898CA4ef35eBfbe
```

### Check Vault Shares
```bash
cast call --rpc-url $ETHEREUM_SEPOLIA_RPC \
  0x1b1870ac9f024d57Bd0670Ba2898CA4ef35eBfbe \
  "balanceOf(address)(uint256)" \
  YOUR_ADDRESS
```

---

## Error Messages Reference

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `execution reverted` | Contract require() failed | Check contract state, parameters |
| `insufficient funds` | Not enough ETH for gas | Add ETH to wallet |
| `gas limit too high` | Gas estimation failed | Set explicit gas limit |
| `nonce too low` | Transaction already mined | Refresh MetaMask |
| `replacement transaction underpriced` | Trying to replace pending tx | Increase gas price or wait |

---

## Frontend Logs Interpretation

### ✅ Good Signs:
- "Transaction confirmed in block XXXXX"
- "Approval tx: 0x..."
- "Deposit requested successfully!"
- "Found pending deposit: X.XX USDC"

### ⚠️ Warning Signs:
- "Polling error: execution reverted"
- "Transaction likely to fail"
- "Wrong network detected"

### ❌ Critical Errors:
- "Vault balance error: execution reverted"
- Transaction failed on Blockscout
- Method name mismatch on Blockscout

---

## Next.js Hot Reload
After making changes to `frontend/app/page.tsx`, Next.js should auto-reload.
If it doesn't:
1. Save the file
2. Refresh browser (Ctrl+R or Cmd+R)
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. If still broken, restart dev server:
   - Kill with Ctrl+C
   - Run `cd frontend && npm run dev`
