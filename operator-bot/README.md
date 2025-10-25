# AsyncVault Operator Bot

Automatically claims deposits and redeems for AsyncVault users.

## Features

✅ **Parallel Processing** - Handles multiple users simultaneously  
✅ **Real-time Events** - Listens for new requests and processes immediately  
✅ **Polling Fallback** - Scans for pending requests every 5 seconds  
✅ **Retry Logic** - Automatically retries failed claims (3 attempts)  
✅ **Error Tracking** - Logs and reports dropped claims  
✅ **Graceful Shutdown** - Handles SIGINT with stats report  

## Installation

```bash
cd operator-bot
npm install
```

## Configuration

The bot reads from `.env` files in the project root:

- `ETHEREUM_SEPOLIA_RPC` - RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Operator private key (deployer is operator)

## Usage

### Recommended: Clean Output (filters ethers.js warnings)
```bash
npm start
# OR
./start.sh
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Alternative: Redirect stderr manually
```bash
node index.js 2>/dev/null  # Suppresses ALL stderr
node index.js 2>&1 | grep -v "filter not found"  # Filters specific warnings
```

## How It Works

### 1. Event Listening (Real-time)
The bot listens for `DepositRequested` and `RedeemRequested` events and immediately processes them.

### 2. Polling (Fallback)
Every 5 seconds, the bot:
1. Scans last 10,000 blocks for user activity
2. Checks each user for pending deposits/redeems
3. Claims any pending requests in parallel

### 3. Parallel Processing
- Multiple users processed simultaneously
- Lock mechanism prevents duplicate claims
- Each user tracked independently

### 4. Error Handling
- **Retries:** 3 attempts with 2-second delay
- **Tracking:** Failed claims logged with details
- **Reporting:** Failed claims report after each cycle

## Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 ASYNCVAULT OPERATOR BOT STARTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Vault: 0x31144B67A0003f88a53c011625DCC28713CeB9AB
🔑 Operator: 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba
🌐 Network: sepolia
⏱️  Poll Interval: 5000ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Operator role verified
👂 Setting up real-time event listeners...
✅ Event listeners active
🚀 Starting polling loop...

🔍 Scanning blocks 9470000 to 9480000 for users...
✅ Found 2 unique users with vault activity
🔄 Checking 2 users for pending claims...

💰 [0x36AB88f...] Pending deposit: 0.1 USDC
⏳ [0x36AB88f...] Claiming deposit...
📤 [0x36AB88f...] Tx sent: 0xabc123...
✅ [0x36AB88f...] Deposit claimed! Block: 9480050

✓ Poll cycle complete

🔔 NEW DEPOSIT REQUEST
   User: 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba
   Amount: 1.0 USDC
   Block: 9480100

💰 [0x36AB88f...] Pending deposit: 1.0 USDC
⏳ [0x36AB88f...] Claiming deposit...
📤 [0x36AB88f...] Tx sent: 0xdef456...
✅ [0x36AB88f...] Deposit claimed! Block: 9480105
```

## Error Scenarios

### Scenario 1: Transaction Reverts
```
❌ [0x36AB88f...] Deposit claim error: execution reverted
🔄 [0x36AB88f...] Retrying deposit claim (1/3)...
```

### Scenario 2: All Retries Failed
```
⚠️  WARNING: Deposit claim dropped for 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba
   Reason: insufficient funds for gas
   Retries: 3/3
```

### Scenario 3: Failed Claims Report
```
⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  FAILED CLAIMS REPORT (1 total)
⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • DEPOSIT: 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba
     Error: insufficient funds for gas
     Time: 2025-10-24T16:55:04.123Z
     Retries: 3/3
⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Monitoring

### Gas Usage
- `claimDepositFor()`: ~80-100k gas
- `claimRedeemFor()`: ~70-90k gas
- Cost per claim: ~0.0001 ETH on Sepolia

### Performance
- Polling: 5 second intervals
- Event response: ~3 seconds after event
- Parallel processing: All users simultaneously

## Troubleshooting

### Bot Not Starting
```bash
# Check environment variables
cat ../contracts-foundry/.env | grep DEPLOYER_PRIVATE_KEY
cat ../.env | grep ETHEREUM_SEPOLIA_RPC
```

### Bot Not Claiming
1. **Check operator role:**
   ```bash
   cast call 0x31144B67A0003f88a53c011625DCC28713CeB9AB "operator()(address)" --rpc-url $ETHEREUM_SEPOLIA_RPC
   ```
2. **Check pending requests:**
   ```bash
   cast call 0x31144B67A0003f88a53c011625DCC28713CeB9AB "pendingDepositRequest(address)(uint256)" $USER_ADDRESS --rpc-url $ETHEREUM_SEPOLIA_RPC
   ```
3. **Check operator balance:**
   ```bash
   cast balance 0x36AB88fDd34848C0caF4599736a9D3a860D051Ba --rpc-url $ETHEREUM_SEPOLIA_RPC
   ```

## Deployment

See [AWS_DEPLOYMENT.md](../docs/AWS_DEPLOYMENT.md) for production deployment instructions.

## Security

- ✅ Only operator can call claim functions
- ✅ Lock mechanism prevents duplicate claims
- ✅ No user funds at risk (operator only processes claims)
- ✅ Private key loaded from environment (never committed)

---

**Status:** ✅ Ready for testing  
**Version:** 1.0.0  
**Last Updated:** October 24, 2025

