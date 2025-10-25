# Testing Guide

## Prerequisites

### Required Balances (Investor Account)
- **Sepolia ETH:** ~0.1 ETH (for gas)
- **USDC:** 10+ USDC (for testing deposits)

**Get USDC:** https://faucet.circle.com/

### Account Setup
- **Investor:** `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba`
- **Simulator:** `0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103`

---

## Test Flow 1: Basic Deposit → Redeem

### Step 1: Connect Wallet
1. Visit http://localhost:3000
2. Connect MetaMask
3. Switch to Ethereum Sepolia
4. Verify you see your USDC balance

### Step 2: Deposit USDC
1. Enter deposit amount (e.g., 1 USDC)
2. Click "Deposit to Vault"
3. **Approve Transaction 1:** `requestDeposit()` - Transfers USDC to vault
4. Wait for polling to detect pending deposit
5. **Approve Transaction 2:** `claimDeposit()` - Mints vault shares
6. Verify your vault shares increased

**Expected:**
- USDC balance decreases by deposit amount
- Vault shares increase by approximately same amount
- Share price should be ~1.0 (1 USDC = 1 share)

### Step 3: Redeem Shares
1. Enter redeem amount (e.g., 1 share)
2. Click "Redeem from Vault"
3. **Approve Transaction 1:** `requestRedeem()` - Burns shares, reserves assets
4. Wait for polling to detect pending redeem
5. **Approve Transaction 2:** `claimRedeem()` - Returns USDC
6. Verify your USDC balance increased

**Expected:**
- Vault shares decrease by redeem amount
- USDC balance increases by approximately same amount
- Share price should still be ~1.0

---

## Test Flow 2: Deposit → Profit → Redeem

### Step 1: Deposit (Same as Flow 1)
- Deposit 10 USDC
- Claim shares (~10 shares)

### Step 2: Simulate Profit
**Switch to Simulator Account in MetaMask:**

1. Import simulator private key (from `.env`)
2. Get USDC from faucet if needed
3. Use Blockscout or cast to call:
   ```bash
   # Transfer 1 USDC profit to vault
   cast send 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
     "transfer(address,uint256)" \
     0x31144B67A0003f88a53c011625DCC28713CeB9AB \
     1000000 \
     --rpc-url $ETHEREUM_SEPOLIA_RPC \
     --private-key $SIMULATOR_PRIVATE_KEY
   
   # Call realizeProfit
   cast send 0x31144B67A0003f88a53c011625DCC28713CeB9AB \
     "realizeProfit(address,uint256)" \
     0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
     1000000 \
     --rpc-url $ETHEREUM_SEPOLIA_RPC \
     --private-key $SIMULATOR_PRIVATE_KEY
   ```

**Or use Blockscout Write Contract:**
1. Go to vault contract on Blockscout
2. Connect simulator wallet
3. Call `realizeProfit(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, 1000000)`

### Step 3: Verify Share Price Increased
**Switch back to Investor Account:**

1. Refresh balances
2. Check vault total assets (should be 11 USDC now)
3. Share price should be ~1.1 (11 USDC / 10 shares)

### Step 4: Redeem and Receive Profit
1. Redeem all 10 shares
2. You should receive ~11 USDC (10 original + 1 profit)
3. Verify you received the profit!

**Expected:**
- User gets more USDC than they deposited
- Demonstrates profit distribution works correctly

---

## Test Flow 3: Multiple Users with Profit

### Setup
1. **User A (Investor):** Deposits 10 USDC
2. **Profit:** Simulator adds 1 USDC (total: 11 USDC, share price: 1.1)
3. **User B (Create new account):** Deposits 5.5 USDC
   - Gets 5 shares (5.5 USDC / 1.1 share price)
   - Total: 16.5 USDC, 15 shares
4. **Profit:** Simulator adds 1.65 USDC (10% gain)
   - Total: 18.15 USDC, 15 shares
   - Share price: 1.21

### Verification
- **User A redeems 10 shares:** Gets 12.1 USDC (21% total gain)
- **User B redeems 5 shares:** Gets 6.05 USDC (10% gain)
- Both users receive fair profit distribution

---

## Test Flow 4: Reserve Mechanism

### Test: Profit After requestRedeem (Before Claim)

1. **User deposits 10 USDC** → Gets 10 shares
2. **User requests redeem 5 shares**
   - Vault calculates: 5 shares = 5 USDC (at current price)
   - Vault reserves 5 USDC
   - User has pending redeem
3. **Simulator adds 5 USDC profit**
   - Total assets: 15 USDC
   - Reserved: 5 USDC
   - Available: 10 USDC
4. **User claims redeem**
   - Gets exactly 5 USDC (snapshotted amount)
   - Profit stays in vault for remaining shareholders

**Expected:**
- User gets the amount calculated at request time
- No race condition or front-running
- Remaining 5 shares now worth 10 USDC (share price doubled!)

### Test: Loss Cannot Touch Reserved Assets

1. **User deposits 10 USDC**
2. **User requests redeem 5 shares** (reserves 5 USDC)
3. **Simulator tries to realize 6 USDC loss**
   - Should REVERT with "Cannot realize loss from reserved assets"
   - Only 5 USDC available (10 total - 5 reserved)

**Expected:**
- Transaction reverts
- User's pending redeem is protected

---

## Monitoring & Debugging

### Check Vault State (Blockscout)
1. Go to vault contract: https://eth-sepolia.blockscout.com/address/0x31144B67A0003f88a53c011625DCC28713CeB9AB
2. Read Contract tab:
   - `totalAssets()` - Total USDC value
   - `totalReserved()` - Assets locked for pending redeems
   - `totalSupply()` - Total shares minted
   - `convertToAssets(1e6)` - Share price (1 share → USDC)

### Check User State
- `balanceOf(userAddress)` - User's share balance
- `pendingDepositRequest(userAddress)` - Pending deposit assets
- `pendingRedeemRequest(userAddress)` - Pending redeem shares/assets

### Check Logs (Frontend)
- In-app log window shows all transactions
- Check browser console for detailed errors
- MetaMask shows transaction history

### Common Issues

**Issue: "Insufficient allowance"**
- Solution: Approve USDC to vault first
- Check: `cast call <USDC> "allowance(address,address)(uint256)" <user> <vault>`

**Issue: "Insufficient vault liquidity"**
- Solution: Not enough available assets (totalAssets - totalReserved)
- Check: `totalReserved()` and `totalAssets()`

**Issue: Multiple MetaMask popups**
- Expected: 2 transactions per deposit/redeem (request + claim)
- Using operator bot would reduce to 1 user transaction

**Issue: Share price not updating after profit**
- Verify: Did simulator actually transfer USDC to vault?
- Check: Vault USDC balance on Blockscout
- Verify: Was `realizeProfit()` called and emitted event?

---

## Performance Benchmarks

### Gas Costs (Approximate)
- `requestDeposit()`: ~120k gas
- `claimDeposit()`: ~80k gas
- `requestRedeem()`: ~90k gas
- `claimRedeem()`: ~70k gas
- `realizeProfit()`: ~50k gas
- `realizeLoss()`: ~75k gas

### Timing
- **Transaction confirmation:** ~12 seconds (Sepolia)
- **Polling interval:** 3 seconds
- **End-to-end deposit:** ~20-30 seconds (request + poll + claim)
- **With operator bot:** ~15 seconds (bot claims immediately)

---

## Next: Automated Testing

Once manual testing confirms everything works, we'll build:

1. **Operator Bot** - Auto-claims deposits/redeems
2. **Market Simulator Bot** - Auto-generates profit/loss
3. **Integration Tests** - Automated test suite
4. **Envio Indexer** - Real-time event tracking

---

**Ready to test? Visit http://localhost:3000 and follow Test Flow 1!**

