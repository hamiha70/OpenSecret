# Operator Bot Race Condition Fix

## Issue Analysis (October 25, 2025)

### What We Found ✅

1. **Bot IS Working Correctly**
   - Successfully detected deposit events
   - Successfully claimed deposits using `claimDepositFor()`
   - Log confirmed: `✅ DEPOSIT CLAIMED: 0x36AB88fD... | 0.1 USDC → shares`

2. **Race Condition Identified**
   - Frontend (self-claim mode) tried to claim with nonce 109
   - Bot successfully claimed with nonce 109 first
   - Frontend got `nonce too low: next nonce 110, tx nonce 109`
   - **This is correct behavior** - the bot won the race!

3. **Two Bugs Discovered**

#### Bug 1: Frontend Still Self-Claiming When Bot Enabled
- **Root Cause**: Frontend `page.tsx` line 369 always called `pollAndClaimDeposit()` regardless of `operatorBotEnabled` toggle
- **Symptom**: MetaMask popup appeared even with "Operator Bot Enabled"
- **Fix**: Added conditional check - only call `pollAndClaimDeposit()` if `!operatorBotEnabled`

#### Bug 2: Bot Polling Fulfilled Claims Endlessly
- **Root Cause**: Bot's `getActiveUsers()` scanned historical `DepositRequested` events from last 10,000 blocks and returned ALL users who ever deposited, not just users with pending claims
- **Symptom**: 
  - Bot logs showed `📥 2 deposits` continuously
  - Bot kept trying to claim already-fulfilled deposits
  - `processDepositClaim()` correctly checked `pendingDepositRequest()` and skipped (no error), but the polling loop kept finding the same users
- **Fix**: Filter users by calling `pendingDepositRequest()` and `pendingRedeemRequest()` BEFORE adding them to the list

## Changes Made

### 1. Frontend (`frontend/app/page.tsx`)
```typescript
// BEFORE
if (operatorBotEnabled) {
  log('🤖 Operator bot mode ENABLED')
  setStatus('⏳ Deposit pending - operator bot will claim automatically')
} else {
  log('👤 Self-claim mode')
  setStatus('⏳ Checking for claimable deposit...')
  pollAndClaimDeposit() // <-- ALWAYS called!
}

// AFTER
if (operatorBotEnabled) {
  log('🤖 Operator bot mode ENABLED - bot will auto-claim for you')
  log('   Frontend will NOT attempt to claim (bot handles it)')
  setStatus('⏳ Deposit pending - operator bot will claim automatically')
  // DO NOT call pollAndClaimDeposit() - let the bot handle it!
} else {
  log('👤 Self-claim mode - you will need to approve claim transaction')
  log('🔄 Starting auto-claim polling...')
  setStatus('⏳ Deposit pending - please approve CLAIM transaction when it appears')
  pollAndClaimDeposit()
}
```

### 2. Operator Bot (`operator-bot/index.js`)
```javascript
// BEFORE
async function getActiveUsers() {
  // ... query events ...
  const users = new Set()
  depositEvents.forEach(event => {
    users.add(event.args.owner)
  })
  return Array.from(users) // <-- Returns ALL users who ever deposited!
}

// AFTER
async function getActiveUsers() {
  // ... query events ...
  const users = new Set()
  depositEvents.forEach(event => {
    users.add(event.args.owner)
  })
  
  // Filter out users with no pending claims (already fulfilled)
  const usersWithPending = []
  for (const user of users) {
    const [pendingDeposit, pendingRedeem] = await Promise.all([
      vault.pendingDepositRequest(user),
      vault.pendingRedeemRequest(user)
    ])
    
    if (pendingDeposit > 0n || pendingRedeem > 0n) {
      usersWithPending.push(user)
    }
  }
  
  console.log(`[Block ${currentBlock}] 👥 ${usersWithPending.length} pending claims | 📥 ${depositEvents.length} deposits | 📤 ${redeemEvents.length} redeems`)
  return usersWithPending
}
```

Also updated log messages:
- "No users found yet" → "✅ All claims fulfilled, waiting for new activity..."
- "Checking N users" → "🔄 Processing N pending claims..."

## Expected Behavior After Fix

### With Bot Enabled:
1. User clicks "Deposit to Vault"
2. MetaMask popup 1: Approve USDC ✅
3. MetaMask popup 2: Request Deposit ✅
4. **NO THIRD POPUP** - frontend does not attempt to claim
5. Bot detects `DepositRequested` event
6. Bot calls `claimDepositFor(user)` automatically
7. User sees shares in their balance

### With Bot Disabled:
1. User clicks "Deposit to Vault"
2. MetaMask popup 1: Approve USDC ✅
3. MetaMask popup 2: Request Deposit ✅
4. Frontend starts polling
5. MetaMask popup 3: Claim Deposit (user approves) ✅
6. User sees shares in their balance

### Bot Polling:
- Scans last 10,000 blocks for events
- Queries `pendingDepositRequest()` and `pendingRedeemRequest()` for each user
- Only processes users with `pending > 0n`
- Logs "✅ All claims fulfilled" when no pending claims exist
- No endless polling of already-claimed requests

## Testing

1. **Bot Enabled Mode**:
   - Deposit 0.1 USDC
   - Verify ONLY 2 MetaMask popups (approve + request)
   - Bot should claim automatically within ~5 seconds
   - Frontend should NOT show "Claim failed: nonce too low"

2. **Bot Disabled Mode**:
   - Deposit 0.1 USDC
   - Verify 3 MetaMask popups (approve + request + claim)
   - User approves claim manually
   - No race condition with bot

3. **Bot Polling**:
   - After all claims are fulfilled, bot logs should show:
     - `[Block XXX] 👥 0 pending claims | 📥 2 deposits | 📤 0 redeems`
     - `✅ All claims fulfilled, waiting for new activity...`
   - Bot should NOT keep trying to claim already-fulfilled requests

## References

- Contract: `0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9` (Sepolia)
- Frontend: `localhost:3002`
- Bot: `operator-bot/index.js`
- Date: October 25, 2025

