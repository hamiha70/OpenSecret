# Fork Testing Ready! 🚀

## What We Built

A comprehensive fork testing suite (`AsyncVault.fork.t.sol`) that tests AsyncVault against **real Sepolia testnet state** before deployment.

## Test Coverage

### ✅ Operator Pattern (Your Main Concern)
- **`test_Fork_OperatorCanClaimForMultipleUsers`** - Simulates bot claiming for multiple users
- **`test_Fork_OperatorCannotClaimTwice`** - Prevents double-claims
- **`test_Fork_NonOperatorCannotClaim`** - Blocks unauthorized access
- **Measures gas costs** for each operation

### ✅ Real USDC Integration
- **`test_Fork_RealUSDCApprovalAndTransfer`** - Tests with actual Sepolia USDC contract
- **`test_Fork_FullDepositRedeemCycle`** - Complete user journey with real tokens
- Validates ERC-20 interactions work correctly

### ✅ Profit/Loss Simulation
- **`test_Fork_SimulatorCanRealizeProfit`** - Tests profit realization with real USDC transfers
- **`test_Fork_SimulatorCanRealizeLoss`** - Tests loss realization
- Verifies share price changes reflect correctly

### ✅ Multi-User Scenarios
- **`test_Fork_MultipleUsersShareProfitProportionally`** - Tests fairness (60/40 split)
- Validates Centrifuge pattern with multiple users
- Checks ERC4626 rounding in real conditions

### ✅ Gas Benchmarks
- **`test_Fork_GasBenchmark_DepositAndClaim`** - Measures actual gas costs
- Helps estimate real user costs on Sepolia

## How to Run

### Quick Test (All Tests)
```bash
cd contracts-foundry
./test-fork.sh
```

### Specific Test
```bash
forge test \
    --match-test test_Fork_OperatorCanClaimForMultipleUsers \
    --fork-url $ETHEREUM_SEPOLIA_RPC \
    -vvv
```

## Prerequisites

1. **USDC on Investor Address:**
   ```bash
   # Check balance
   cast balance $INVESTOR_ADDRESS --rpc-url $ETHEREUM_SEPOLIA_RPC --erc20 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   
   # Get from faucet: https://faucet.circle.com/
   ```

2. **USDC on Simulator Address:**
   ```bash
   # Check balance
   cast balance $SIMULATOR_ADDRESS --rpc-url $ETHEREUM_SEPOLIA_RPC --erc20 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   
   # Need ~15 USDC for profit tests
   ```

3. **Sepolia RPC URL in `.env`:**
   ```bash
   ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```

## What Gets Tested

| Test | What It Validates |
|------|-------------------|
| Real USDC | Actual Sepolia USDC contract works |
| Operator Claims | Bot can claim for multiple users |
| Access Control | Only operator can claim |
| No Double Claims | Can't claim twice |
| Profit Realization | Simulator can add profits |
| Loss Realization | Simulator can realize losses |
| Multi-User Fairness | Profits split proportionally |
| Gas Costs | Measures real network costs |

## Expected Gas Costs

- `requestDeposit`: ~100k gas (~$0.50 @ 50 gwei)
- `claimDepositFor`: ~80k gas (~$0.40 @ 50 gwei)
- `requestRedeem`: ~85k gas (~$0.43 @ 50 gwei)
- `claimRedeemFor`: ~75k gas (~$0.38 @ 50 gwei)

## What Success Looks Like

```
Running 10 tests for test/AsyncVault.fork.t.sol:AsyncVaultForkTest
[PASS] test_Fork_FullDepositRedeemCycle (gas: 350000)
[PASS] test_Fork_GasBenchmark_DepositAndClaim (gas: 280000)
[PASS] test_Fork_MultipleUsersShareProfitProportionally (gas: 650000)
[PASS] test_Fork_NonOperatorCannotClaim (gas: 150000)
[PASS] test_Fork_OperatorCanClaimForMultipleUsers (gas: 450000)
[PASS] test_Fork_OperatorCannotClaimTwice (gas: 220000)
[PASS] test_Fork_RealUSDCApprovalAndTransfer (gas: 180000)
[PASS] test_Fork_SimulatorCanRealizeLoss (gas: 320000)
[PASS] test_Fork_SimulatorCanRealizeProfit (gas: 340000)

Suite result: ok. 9 passed; 0 failed; 0 skipped
```

If you see this, you're **ready to deploy!** ✅

## Next Steps After Passing

1. ✅ Review gas costs - acceptable?
2. ✅ Operator pattern works - ready for bot deployment?
3. ✅ Multi-user tests pass - no race conditions?
4. ✅ Deploy to Sepolia:
   ```bash
   forge script script/DeployAsyncVault.s.sol \
       --rpc-url $ETHEREUM_SEPOLIA_RPC \
       --broadcast
   ```

## Common Issues

### "Investor needs USDC from faucet"
**Fix:** Get USDC from https://faucet.circle.com/

### "transport error"
**Fix:** Check RPC URL, may need different provider

### Tests hang
**Fix:** RPC rate limiting - use premium provider or try again

## Documentation

See `/docs/FORK_TESTING.md` for comprehensive guide including:
- Detailed test explanations
- Debugging instructions
- Advanced usage
- Troubleshooting tips

## Why This Matters

Fork testing catches issues **before** you:
- Spend real testnet ETH on deployment
- Discover bugs after users deposit
- Find out operator bot doesn't work
- Realize gas costs are too high

**Run these tests now, save headaches later!** 🎯

