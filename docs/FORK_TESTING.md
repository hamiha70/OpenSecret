# Fork Testing Guide

This guide explains how to test AsyncVault against real Sepolia testnet state before deploying.

## Why Fork Testing?

Fork testing runs your contract against a **real blockchain snapshot**, allowing you to:

1. ✅ Test with **real USDC** contract (not mocked)
2. ✅ Verify **operator pattern** works with actual accounts
3. ✅ Measure **gas costs** on real network conditions
4. ✅ Catch **integration issues** before spending real testnet ETH
5. ✅ Test **multi-user scenarios** safely

## Prerequisites

### 1. USDC on Sepolia

You need USDC on the investor and simulator addresses. Get it from:
- **Circle Faucet:** https://faucet.circle.com/ (10 USDC/day)
- **Chainlink Faucet:** https://faucets.chain.link/sepolia (includes USDC)

Check your balance:
```bash
cast balance 0xYourAddress --rpc-url $ETHEREUM_SEPOLIA_RPC --erc20 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

### 2. RPC URL

You need a Sepolia RPC endpoint. Options:
- **QuickNode** (free tier): https://www.quicknode.com/
- **Alchemy** (free tier): https://www.alchemy.com/
- **Infura** (free tier): https://www.infura.io/

Add to `.env`:
```bash
ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 3. Environment Variables

Ensure your `.env` has:
```bash
ETHEREUM_SEPOLIA_RPC=<your-rpc-url>
DEPLOYER_ADDRESS=0x...
INVESTOR_ADDRESS=0x...
SIMULATOR_ADDRESS=0x...
```

## Running Fork Tests

### Quick Run (All Tests)

```bash
cd contracts-foundry
./test-fork.sh
```

### Run Specific Test

```bash
forge test \
    --match-test test_Fork_OperatorCanClaimForMultipleUsers \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    -vvv
```

### Run with Gas Report

```bash
forge test \
    --match-contract AsyncVaultForkTest \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    --gas-report \
    -vv
```

## Test Coverage

### ✅ Basic Integration (`test_Fork_RealUSDCApprovalAndTransfer`)
- Tests USDC approval with real contract
- Verifies `requestDeposit` transfers USDC correctly

### ✅ Full Cycle (`test_Fork_FullDepositRedeemCycle`)
- Complete flow: deposit → claim → redeem → claim
- Measures gas costs for each operation
- Verifies USDC returns to user (±1 wei)

### ✅ Operator Pattern (`test_Fork_OperatorCanClaimForMultipleUsers`)
- **YOUR KEY TEST** - Operator bot simulation
- Tests claiming for multiple users sequentially
- Measures gas per claim operation
- Verifies parallel deposit handling

### ✅ Access Control (`test_Fork_OperatorCannotClaimTwice`, `test_Fork_NonOperatorCannotClaim`)
- Prevents double-claiming
- Blocks unauthorized claims
- Validates security model

### ✅ Profit/Loss Simulation (`test_Fork_SimulatorCanRealizeProfit`, `test_Fork_SimulatorCanRealizeLoss`)
- Simulator transfers real USDC
- Share price changes reflected
- Investors get profit proportionally

### ✅ Multi-User Scenarios (`test_Fork_MultipleUsersShareProfitProportionally`)
- Tests fairness in profit distribution
- Validates Centrifuge pattern
- Checks 60/40 split accuracy

### ✅ Gas Benchmarks (`test_Fork_GasBenchmark_DepositAndClaim`)
- Measures real gas costs
- Helps estimate user costs
- Typical values:
  - `requestDeposit`: ~100k gas (~$0.50 @ 50 gwei)
  - `claimDepositFor`: ~80k gas (~$0.40 @ 50 gwei)

## Interpreting Results

### ✅ Success Output

```
[PASS] test_Fork_OperatorCanClaimForMultipleUsers (gas: 450000)
  Operator claimed for both users:
    Gas for user1: 82345
    Gas for user2: 78901
```

**What this means:**
- Operator pattern works ✅
- Gas costs are reasonable ✅
- Ready for deployment ✅

### ❌ Common Failures

**1. "Investor needs USDC from faucet"**
```
Error: Investor needs USDC from faucet
```
**Fix:** Get USDC from Circle/Chainlink faucet

**2. "Only operator" revert**
```
Error: Only operator
```
**Fix:** Check that `DEPLOYER_ADDRESS` matches operator in contract

**3. "Insufficient balance" in profit tests**
```
Error: Simulator needs USDC for profit
```
**Fix:** Ensure simulator address has USDC for profit simulation

**4. RPC errors**
```
Error: transport error
```
**Fix:** Check RPC URL, may need to use a different provider or upgrade plan

## Expected Gas Costs (Sepolia)

| Operation | Gas Cost | USD @ 50 gwei* |
|-----------|----------|----------------|
| `requestDeposit` | ~100k | $0.50 |
| `claimDepositFor` | ~80k | $0.40 |
| `requestRedeem` | ~85k | $0.43 |
| `claimRedeemFor` | ~75k | $0.38 |
| `realizeProfit` | ~50k | $0.25 |
| `realizeLoss` | ~65k | $0.33 |

*Assuming 50 gwei gas price and $2500 ETH price

## Debugging Fork Tests

### View Detailed Traces

```bash
forge test \
    --match-test test_Fork_OperatorCanClaimForMultipleUsers \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    -vvvv  # 4 v's = maximum verbosity
```

### Check Specific Block

```bash
forge test \
    --match-contract AsyncVaultForkTest \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    --fork-block-number 7000000 \
    -vv
```

### Use Debugger

```bash
forge test \
    --match-test test_Fork_FullDepositRedeemCycle \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    --debug
```

## Next Steps After Successful Fork Tests

1. ✅ **Review gas costs** - Are they acceptable for users?
2. ✅ **Verify operator pattern** - Does the bot flow work correctly?
3. ✅ **Check multi-user scenarios** - Any race conditions?
4. ✅ **Test profit/loss** - Share price changes correct?

If all tests pass:

```bash
# Deploy to Sepolia
cd contracts-foundry
forge script script/DeployAsyncVault.s.sol \
    --rpc-url $ETHEREUM_SEPOLIA_RPC \
    --broadcast
```

## Troubleshooting

### Test hangs or takes forever
- **Cause:** RPC rate limiting or slow connection
- **Fix:** Use a premium RPC provider or add `--fork-retry-backoff`

### "Transaction reverted without a reason"
- **Cause:** Usually insufficient USDC balance
- **Fix:** Check balances with `cast balance --erc20`

### Different results each run
- **Cause:** Fork state changes between runs
- **Fix:** Pin to specific block: `--fork-block-number 7000000`

## Advanced: Local Fork Server

For faster iteration, run a persistent fork:

```bash
# Terminal 1: Start local fork
anvil --fork-url $ETHEREUM_SEPOLIA_RPC --fork-block-number 7000000

# Terminal 2: Run tests against local fork
forge test \
    --match-contract AsyncVaultForkTest \
    --fork-url http://localhost:8545 \
    -vv
```

This is much faster for debugging since the fork state persists.

## References

- **Foundry Fork Testing:** https://book.getfoundry.sh/forge/fork-testing
- **Sepolia USDC Contract:** https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
- **USDC Faucets:** See `/docs/USDC_FAUCETS.md`

