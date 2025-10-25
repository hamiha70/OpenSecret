// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AsyncVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AsyncVault Forked Tests
 * @notice Tests AsyncVault against real Sepolia testnet state
 * @dev Run with: forge test --match-contract AsyncVaultForkTest --fork-url $ETHEREUM_SEPOLIA_RPC -vv
 * 
 * Tests:
 * 1. Real USDC contract interaction
 * 2. Operator pattern with actual accounts
 * 3. Gas costs on real network
 * 4. Multi-user scenarios
 * 5. Profit/loss simulation
 */
contract AsyncVaultForkTest is Test {
    AsyncVault public vault;
    IERC20 public usdc;

    // Real Sepolia USDC address
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    // Test accounts (we'll load from .env)
    address deployer;
    address operator;
    address simulator;
    address investor1;
    address investor2;

    // USDC has 6 decimals
    uint256 constant USDC_DECIMALS = 1e6;

    function setUp() public {
        // Fork Sepolia at latest block using RPC from environment
        string memory rpcUrl = vm.envString("ETHEREUM_SEPOLIA_RPC");
        vm.createSelectFork(rpcUrl);
        
        // Load real addresses from environment
        deployer = vm.envAddress("DEPLOYER_ADDRESS");
        operator = vm.envAddress("DEPLOYER_ADDRESS"); // Operator is deployer for now
        simulator = vm.envAddress("SIMULATOR_ADDRESS");
        investor1 = vm.envAddress("INVESTOR_ADDRESS");
        
        // Create a second investor for multi-user tests
        investor2 = makeAddr("investor2");
        
        console.log("Fork Setup:");
        console.log("  Deployer:", deployer);
        console.log("  Operator:", operator);
        console.log("  Simulator:", simulator);
        console.log("  Investor1:", investor1);
        console.log("  Investor2:", investor2);
        
        // Use real Sepolia USDC
        usdc = IERC20(SEPOLIA_USDC);
        
        // Deploy vault as deployer
        vm.startPrank(deployer);
        vault = new AsyncVault(
            SEPOLIA_USDC,
            operator,
            simulator,
            "AsyncVault USDC",
            "asUSDC"
        );
        vm.stopPrank();
        
        console.log("Vault deployed at:", address(vault));
        console.log("USDC balance of investor1:", usdc.balanceOf(investor1) / USDC_DECIMALS);
        console.log("USDC balance of simulator:", usdc.balanceOf(simulator) / USDC_DECIMALS);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // BASIC INTEGRATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_RealUSDCApprovalAndTransfer() public {
        uint256 amount = 2 * USDC_DECIMALS; // 2 USDC (small test amount)
        
        // Check investor has USDC
        uint256 balance = usdc.balanceOf(investor1);
        require(balance >= amount, "Investor needs USDC from faucet");
        
        vm.startPrank(investor1);
        
        // Test approval
        usdc.approve(address(vault), amount);
        assertEq(usdc.allowance(investor1, address(vault)), amount, "Approval failed");
        
        // Test requestDeposit with real USDC
        vault.requestDeposit(amount);
        
        // Check USDC was transferred
        assertEq(usdc.balanceOf(address(vault)), amount, "USDC not transferred to vault");
        
        vm.stopPrank();
    }

    function test_Fork_FullDepositRedeemCycle() public {
        uint256 depositAmount = 3 * USDC_DECIMALS; // 3 USDC (small test amount)
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        // 1. Investor requests deposit
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        console.log("After requestDeposit:");
        console.log("  Vault USDC:", usdc.balanceOf(address(vault)) / USDC_DECIMALS);
        console.log("  Investor shares:", vault.balanceOf(investor1));
        
        // 2. Operator claims deposit
        vm.prank(operator);
        uint256 gasClaim = gasleft();
        vault.claimDepositFor(investor1);
        gasClaim = gasClaim - gasleft();
        console.log("Gas used for claimDepositFor:", gasClaim);
        
        uint256 shares = vault.balanceOf(investor1);
        assertEq(shares, depositAmount, "Should get 1:1 shares in bootstrap");
        
        console.log("After claimDeposit:");
        console.log("  Investor shares:", shares / USDC_DECIMALS);
        
        // 3. Investor requests redeem
        vm.prank(investor1);
        vault.requestRedeem(shares);
        
        // 4. Operator claims redeem
        vm.prank(operator);
        uint256 gasRedeem = gasleft();
        vault.claimRedeemFor(investor1);
        gasRedeem = gasRedeem - gasleft();
        console.log("Gas used for claimRedeemFor:", gasRedeem);
        
        // 5. Verify investor got USDC back (may be ±1 wei due to rounding)
        assertApproxEqAbs(usdc.balanceOf(investor1), initialBalance, 1, "Should get USDC back");
        
        console.log("After claimRedeem:");
        console.log("  Investor USDC:", usdc.balanceOf(investor1) / USDC_DECIMALS);
        console.log("  Investor shares:", vault.balanceOf(investor1));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // OPERATOR PATTERN TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_OperatorCanClaimForMultipleUsers() public {
        uint256 amount = 2 * USDC_DECIMALS; // 2 USDC each (small test amount)
        
        require(usdc.balanceOf(investor1) >= amount, "Investor1 needs USDC");
        
        // Give investor2 some USDC (simulate faucet)
        deal(SEPOLIA_USDC, investor2, 10 * USDC_DECIMALS);
        
        // Both investors request deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), amount);
        vault.requestDeposit(amount);
        vm.stopPrank();
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), amount);
        vault.requestDeposit(amount);
        vm.stopPrank();
        
        console.log("Pending deposits recorded");
        
        // Operator claims for both (simulating bot behavior)
        vm.startPrank(operator);
        
        uint256 gasClaim1 = gasleft();
        vault.claimDepositFor(investor1);
        gasClaim1 = gasClaim1 - gasleft();
        
        uint256 gasClaim2 = gasleft();
        vault.claimDepositFor(investor2);
        gasClaim2 = gasClaim2 - gasleft();
        
        vm.stopPrank();
        
        console.log("Operator claimed for both users:");
        console.log("  Gas for user1:", gasClaim1);
        console.log("  Gas for user2:", gasClaim2);
        console.log("  Investor1 shares:", vault.balanceOf(investor1) / USDC_DECIMALS);
        console.log("  Investor2 shares:", vault.balanceOf(investor2) / USDC_DECIMALS);
        
        // Both should have shares
        assertEq(vault.balanceOf(investor1), amount, "Investor1 should have shares");
        assertEq(vault.balanceOf(investor2), amount, "Investor2 should have shares");
    }

    function test_Fork_OperatorCannotClaimTwice() public {
        uint256 amount = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= amount, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), amount);
        vault.requestDeposit(amount);
        vm.stopPrank();
        
        // First claim succeeds
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // Second claim should fail
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimDepositFor(investor1);
    }

    function test_Fork_NonOperatorCannotClaim() public {
        uint256 amount = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= amount, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), amount);
        vault.requestDeposit(amount);
        vm.stopPrank();
        
        // Random address tries to claim
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert("Only operator");
        vault.claimDepositFor(investor1);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PROFIT/LOSS SIMULATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_SimulatorCanRealizeProfit() public {
        uint256 depositAmount = 4 * USDC_DECIMALS; // 4 USDC deposit
        uint256 profitAmount = 1 * USDC_DECIMALS;  // 1 USDC profit (25%)
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        require(usdc.balanceOf(simulator) >= profitAmount, "Simulator needs USDC for profit");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        // Setup: Investor deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        uint256 shares = vault.balanceOf(investor1);
        
        // Simulator realizes profit
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profitAmount);
        vault.realizeProfit(address(usdc), profitAmount);
        vm.stopPrank();
        
        console.log("After profit:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS);
        console.log("  Share value:", vault.convertToAssets(shares) / USDC_DECIMALS);
        
        // Verify share price increased
        uint256 shareValue = vault.convertToAssets(shares);
        assertApproxEqAbs(shareValue, depositAmount + profitAmount, 1, "Share value should reflect profit");
        
        // Investor redeems and gets profit
        vm.prank(investor1);
        vault.requestRedeem(shares);
        
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        // Should get back: (initialBalance - depositAmount) + depositAmount + profitAmount
        // = initialBalance + profitAmount
        assertApproxEqAbs(
            usdc.balanceOf(investor1), 
            initialBalance + profitAmount,
            1, 
            "Should receive profit"
        );
    }

    function test_Fork_SimulatorCanRealizeLoss() public {
        uint256 depositAmount = 4 * USDC_DECIMALS; // 4 USDC deposit
        uint256 lossAmount = 1 * USDC_DECIMALS;    // 1 USDC loss (25%)
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // Setup: Investor deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        uint256 shares = vault.balanceOf(investor1);
        
        // Simulator realizes loss
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), lossAmount);
        
        console.log("After loss:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS);
        console.log("  Simulator USDC:", usdc.balanceOf(simulator) / USDC_DECIMALS);
        
        // Verify share price decreased
        uint256 shareValue = vault.convertToAssets(shares);
        assertApproxEqAbs(shareValue, depositAmount - lossAmount, 1, "Share value should reflect loss");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // MULTI-USER SCENARIOS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_MultipleUsersShareProfitProportionally() public {
        uint256 deposit1 = 3 * USDC_DECIMALS; // 60% of deposits (3 USDC)
        uint256 deposit2 = 2 * USDC_DECIMALS; // 40% of deposits (2 USDC)
        uint256 profit = 1 * USDC_DECIMALS;   // 1 USDC profit (20%)
        
        require(usdc.balanceOf(investor1) >= deposit1, "Investor1 needs USDC");
        deal(SEPOLIA_USDC, investor2, deposit2); // Give investor2 exactly what they need
        require(usdc.balanceOf(simulator) >= profit, "Simulator needs USDC");
        
        uint256 investor1InitialBalance = usdc.balanceOf(investor1);
        
        // Both deposit
        vm.startPrank(investor1);
        usdc.approve(address(vault), deposit1);
        vault.requestDeposit(deposit1);
        vm.stopPrank();
        
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), deposit2);
        vault.requestDeposit(deposit2);
        vm.stopPrank();
        
        vm.prank(operator);
        vault.claimDepositFor(investor2);
        
        // Realize profit
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("After profit, before redeem:");
        console.log("  Investor1 shares:", vault.balanceOf(investor1));
        console.log("  Investor2 shares:", vault.balanceOf(investor2));
        console.log("  Total supply:", vault.totalSupply());
        console.log("  Total assets:", vault.totalAssets());
        
        // Both redeem (request first, then claim)
        uint256 investor1Shares = vault.balanceOf(investor1);
        uint256 investor2Shares = vault.balanceOf(investor2);
        
        vm.prank(investor1);
        vault.requestRedeem(investor1Shares);
        
        vm.prank(investor2);
        vault.requestRedeem(investor2Shares);
        
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        vm.prank(operator);
        vault.claimRedeemFor(investor2);
        
        // Check proportional profit
        // Investor1: deposited 3, gets back 3.6 (60% of 1 USDC profit = 0.6)
        // Investor2: deposited 2, gets back 2.4 (40% of 1 USDC profit = 0.4)
        console.log("Final balances:");
        console.log("  Investor1:", usdc.balanceOf(investor1), "USDC");
        console.log("  Investor2:", usdc.balanceOf(investor2), "USDC");
        
        // Investor1: initialBalance - deposit1 + (deposit1 + 0.6) = initialBalance + 0.6
        assertApproxEqAbs(usdc.balanceOf(investor1), investor1InitialBalance + 0.6e6, 1, "Investor1 60% profit");
        // Investor2: 0 + 2.4 = 2.4 USDC (we dealt them exactly deposit2, they get back deposit2 + profit)
        assertApproxEqAbs(usdc.balanceOf(investor2), 2.4e6, 1, "Investor2 40% profit");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // GAS BENCHMARKS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_GasBenchmark_DepositAndClaim() public {
        uint256 amount = 2 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= amount, "Need USDC");
        
        // Measure requestDeposit gas
        vm.startPrank(investor1);
        usdc.approve(address(vault), amount);
        uint256 gasRequest = gasleft();
        vault.requestDeposit(amount);
        gasRequest = gasRequest - gasleft();
        vm.stopPrank();
        
        // Measure claimDepositFor gas
        vm.prank(operator);
        uint256 gasClaim = gasleft();
        vault.claimDepositFor(investor1);
        gasClaim = gasClaim - gasleft();
        
        console.log("=== GAS BENCHMARK ===");
        console.log("requestDeposit:   ", gasRequest);
        console.log("claimDepositFor:  ", gasClaim);
        console.log("Total user flow:  ", gasRequest + gasClaim);
        
        // These are just informational, no assertions
        // Typical values: requestDeposit ~100k, claimDepositFor ~80k
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // USER SELF-CLAIM TESTS (vs operator claim)
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_UserCanSelfClaimDeposit() public {
        uint256 depositAmount = 3 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // User deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        
        // User self-claims (NOT operator)
        vault.claimDeposit();
        vm.stopPrank();
        
        // Verify user received shares
        assertEq(vault.balanceOf(investor1), depositAmount, "User should have shares");
    }

    function test_Fork_UserCanSelfClaimRedeem() public {
        uint256 depositAmount = 3 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        // Setup: deposit and claim
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        
        uint256 shares = vault.balanceOf(investor1);
        
        // User redeems and self-claims
        vault.requestRedeem(shares);
        vault.claimRedeem();
        vm.stopPrank();
        
        // Verify user got USDC back
        assertApproxEqAbs(usdc.balanceOf(investor1), initialBalance, 1, "Should get USDC back");
        assertEq(vault.balanceOf(investor1), 0, "Should have no shares");
    }

    function test_Fork_OperatorCannotClaimIfUserAlreadyClaimed() public {
        uint256 depositAmount = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // User deposits and self-claims
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        vm.stopPrank();
        
        // Operator tries to claim again
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimDepositFor(investor1);
    }

    function test_Fork_UserCannotClaimIfOperatorAlreadyClaimed() public {
        uint256 depositAmount = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // User deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        // Operator claims
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // User tries to self-claim
        vm.prank(investor1);
        vm.expectRevert("Already fulfilled");
        vault.claimDeposit();
    }

    function test_Fork_MixedClaimingMultipleUsers() public {
        uint256 deposit1 = 3 * USDC_DECIMALS;
        uint256 deposit2 = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= deposit1, "Need USDC");
        deal(SEPOLIA_USDC, investor2, deposit2);
        
        // Investor1 deposits (will self-claim)
        vm.startPrank(investor1);
        usdc.approve(address(vault), deposit1);
        vault.requestDeposit(deposit1);
        vm.stopPrank();
        
        // Investor2 deposits (operator will claim)
        vm.startPrank(investor2);
        usdc.approve(address(vault), deposit2);
        vault.requestDeposit(deposit2);
        vm.stopPrank();
        
        // Investor1 self-claims
        vm.prank(investor1);
        vault.claimDeposit();
        
        // Operator claims for investor2
        vm.prank(operator);
        vault.claimDepositFor(investor2);
        
        // Both should have shares
        assertEq(vault.balanceOf(investor1), deposit1, "Investor1 should have shares");
        assertEq(vault.balanceOf(investor2), deposit2, "Investor2 should have shares");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SHARE PRICE CALCULATION TESTS (existing vault state)
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_ShareCalculationWithExistingShares() public {
        // Setup: Create a vault with existing state
        // Investor1 deposits 10 USDC, gets 10M shares (1:1 initially)
        uint256 initialDeposit = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= initialDeposit, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), initialDeposit);
        vault.requestDeposit(initialDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        console.log("After initial deposit:");
        console.log("  Total assets:", vault.totalAssets());
        console.log("  Total supply:", vault.totalSupply());
        console.log("  Share price:", vault.convertToAssets(1e18), "assets per 1e18 shares");
        
        // Now investor2 deposits 5 USDC
        // Should get 5M shares (still 1:1 since no profit/loss)
        uint256 secondDeposit = 5 * USDC_DECIMALS;
        deal(SEPOLIA_USDC, investor2, secondDeposit);
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), secondDeposit);
        vault.requestDeposit(secondDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        console.log("After second deposit:");
        console.log("  Total assets:", vault.totalAssets());
        console.log("  Total supply:", vault.totalSupply());
        console.log("  Investor2 shares:", vault.balanceOf(investor2));
        
        // Verify: investor2 should have ~5M shares (1:1 ratio maintained)
        assertEq(vault.balanceOf(investor2), secondDeposit, "Should maintain 1:1 ratio");
    }

    function test_Fork_ShareCalculationAfterProfit() public {
        // Setup: Create vault with existing state
        uint256 initialDeposit = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= initialDeposit, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), initialDeposit);
        vault.requestDeposit(initialDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        // Realize 5 USDC profit (50% gain)
        // Now: 10M shares backed by 15 USDC = 1.5 USDC per share
        uint256 profit = 5 * USDC_DECIMALS;
        require(usdc.balanceOf(simulator) >= profit, "Simulator needs USDC");
        
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("After profit:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Total supply:", vault.totalSupply() / USDC_DECIMALS, "M shares");
        console.log("  Share price: 1 share =", vault.convertToAssets(1e6), "USDC (scaled by 1e6)");
        
        // Now investor2 deposits 6 USDC
        // Should get: 6 USDC / 1.5 USDC per share = 4M shares
        uint256 secondDeposit = 6 * USDC_DECIMALS;
        deal(SEPOLIA_USDC, investor2, secondDeposit);
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), secondDeposit);
        vault.requestDeposit(secondDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 expectedShares = vault.convertToShares(secondDeposit);
        console.log("Investor2 got:", vault.balanceOf(investor2) / USDC_DECIMALS, "M shares");
        console.log("Expected:", expectedShares / USDC_DECIMALS, "M shares");
        
        // Verify: investor2 should get 4M shares (6 USDC / 1.5 = 4)
        assertApproxEqAbs(vault.balanceOf(investor2), 4 * USDC_DECIMALS, 1, "Should get 4M shares");
    }

    function test_Fork_ShareCalculationAfterLoss() public {
        // Setup: Create vault with existing state
        uint256 initialDeposit = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= initialDeposit, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), initialDeposit);
        vault.requestDeposit(initialDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        // Realize 2 USDC loss (20% loss)
        // Now: 10M shares backed by 8 USDC = 0.8 USDC per share
        uint256 loss = 2 * USDC_DECIMALS;
        
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), loss);
        
        console.log("After loss:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Total supply:", vault.totalSupply() / USDC_DECIMALS, "M shares");
        console.log("  Share price: 1 share =", vault.convertToAssets(1e6), "USDC (scaled by 1e6)");
        
        // Now investor2 deposits 4 USDC
        // Should get: 4 USDC / 0.8 USDC per share = 5M shares
        uint256 secondDeposit = 4 * USDC_DECIMALS;
        deal(SEPOLIA_USDC, investor2, secondDeposit);
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), secondDeposit);
        vault.requestDeposit(secondDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 expectedShares = vault.convertToShares(secondDeposit);
        console.log("Investor2 got:", vault.balanceOf(investor2) / USDC_DECIMALS, "M shares");
        console.log("Expected:", expectedShares / USDC_DECIMALS, "M shares");
        
        // Verify: investor2 should get 5M shares (4 USDC / 0.8 = 5)
        assertApproxEqAbs(vault.balanceOf(investor2), 5 * USDC_DECIMALS, 1, "Should get 5M shares");
    }

    function test_Fork_LargeVaultState_NewSmallDeposit() public {
        // Simulate a large existing vault
        // Investor1 deposits 100 USDC
        uint256 largeDeposit = 42 * USDC_DECIMALS; // Use all available
        require(usdc.balanceOf(investor1) >= largeDeposit, "Need USDC");
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), largeDeposit);
        vault.requestDeposit(largeDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        // Realize significant profit (20 USDC)
        // Now: 42M shares backed by 62 USDC
        uint256 profit = 15 * USDC_DECIMALS; // Use available simulator USDC
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("Large vault state:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Total supply:", vault.totalSupply() / USDC_DECIMALS, "M shares");
        console.log("  Share price:", vault.convertToAssets(1e6), "per 1M shares");
        
        // Small investor deposits 2 USDC
        uint256 smallDeposit = 2 * USDC_DECIMALS;
        deal(SEPOLIA_USDC, investor2, smallDeposit);
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), smallDeposit);
        vault.requestDeposit(smallDeposit);
        vault.claimDeposit();
        vm.stopPrank();
        
        // Verify small investor gets proportional shares
        uint256 expectedShares = vault.convertToShares(smallDeposit);
        console.log("Small investor got:", vault.balanceOf(investor2));
        console.log("Expected shares:", expectedShares);
        
        assertApproxEqAbs(vault.balanceOf(investor2), expectedShares, 2, "Should get correct share amount");
        
        // Verify share price is maintained
        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();
        console.log("Final state:");
        console.log("  Total assets:", totalAssets / USDC_DECIMALS, "USDC");
        console.log("  Total supply:", totalSupply / USDC_DECIMALS, "M shares");
        
        // Total assets should be ~59 USDC (42 + 15 + 2)
        assertApproxEqAbs(totalAssets, 59 * USDC_DECIMALS, 2, "Total assets correct");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PROFIT/LOSS BETWEEN REQUEST AND CLAIM (Centrifuge Pattern Tests)
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_ProfitBetweenDepositRequestAndClaim() public {
        uint256 depositAmount = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        // User deposits and requests
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        // PROFIT happens between request and claim!
        // This should NOT affect the deposit (user deposited 10, should get 10M shares)
        uint256 profit = 5 * USDC_DECIMALS;
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("After profit, before claim:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Total supply:", vault.totalSupply() / USDC_DECIMALS, "M shares");
        
        // Now claim the deposit
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // User should still get 10M shares (deposit was already in vault)
        // But now those 10M shares are worth more due to profit!
        assertEq(vault.balanceOf(investor1), depositAmount, "Should get original share amount");
        
        console.log("After claim:");
        console.log("  Investor1 shares:", vault.balanceOf(investor1) / USDC_DECIMALS, "M");
        console.log("  Share value:", vault.convertToAssets(vault.balanceOf(investor1)) / USDC_DECIMALS, "USDC");
    }

    function test_Fork_ProfitBetweenRedeemRequestAndClaim_UserGetsProfit() public {
        // Setup: User has shares in vault
        uint256 depositAmount = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 shares = vault.balanceOf(investor1);
        console.log("Initial state:");
        console.log("  User has:", shares / USDC_DECIMALS, "M shares");
        console.log("  Worth:", vault.convertToAssets(shares) / USDC_DECIMALS, "USDC");
        
        // User requests redeem
        vm.prank(investor1);
        vault.requestRedeem(shares);
        
        // PROFIT happens between request and claim! (Centrifuge pattern test)
        // User should benefit from this profit at claim time
        uint256 profit = 5 * USDC_DECIMALS;
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("After profit, before claim:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Share value:", vault.convertToAssets(shares) / USDC_DECIMALS, "USDC");
        
        // Claim redeem (assets calculated NOW, not at request time)
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        uint256 finalBalance = usdc.balanceOf(investor1);
        console.log("Final balance:", finalBalance / USDC_DECIMALS, "USDC");
        console.log("Profit gained:", (finalBalance - initialBalance) / USDC_DECIMALS, "USDC");
        
        // User should get MORE than they deposited (10 + 5 = 15 USDC)
        assertApproxEqAbs(finalBalance, initialBalance + profit, 1, "User should get profit");
        assertGt(finalBalance, initialBalance, "User must profit");
    }

    function test_Fork_LossBetweenRedeemRequestAndClaim_UserBearsLoss() public {
        // Setup: User has shares in vault
        uint256 depositAmount = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 shares = vault.balanceOf(investor1);
        console.log("Initial state:");
        console.log("  User has:", shares / USDC_DECIMALS, "M shares");
        console.log("  Worth:", vault.convertToAssets(shares) / USDC_DECIMALS, "USDC");
        
        // User requests redeem
        vm.prank(investor1);
        vault.requestRedeem(shares);
        
        // LOSS happens between request and claim! (Centrifuge pattern test)
        // User should bear this loss at claim time
        uint256 loss = 3 * USDC_DECIMALS;
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), loss);
        
        console.log("After loss, before claim:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  Share value:", vault.convertToAssets(shares) / USDC_DECIMALS, "USDC");
        
        // Claim redeem (assets calculated NOW, not at request time)
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        uint256 finalBalance = usdc.balanceOf(investor1);
        console.log("Final balance:", finalBalance / USDC_DECIMALS, "USDC");
        console.log("Loss absorbed:", (initialBalance - finalBalance) / USDC_DECIMALS, "USDC");
        
        // User should get LESS than they deposited (10 - 3 = 7 USDC)
        assertApproxEqAbs(finalBalance, initialBalance - loss, 1, "User should bear loss");
        assertLt(finalBalance, initialBalance, "User must absorb loss");
    }

    function test_Fork_MultipleProfit_LossEvents_BetweenRequestAndClaim() public {
        // Setup: User deposits
        uint256 depositAmount = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 shares = vault.balanceOf(investor1);
        
        // User requests redeem
        vm.prank(investor1);
        vault.requestRedeem(shares);
        
        // Multiple events between request and claim!
        // +5 USDC profit
        vm.startPrank(simulator);
        usdc.transfer(address(vault), 5 * USDC_DECIMALS);
        vault.realizeProfit(address(usdc), 5 * USDC_DECIMALS);
        vm.stopPrank();
        
        console.log("After +5 profit:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        
        // -2 USDC loss
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), 2 * USDC_DECIMALS);
        
        console.log("After -2 loss:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        
        // +1 USDC profit again
        vm.startPrank(simulator);
        usdc.transfer(address(vault), 1 * USDC_DECIMALS);
        vault.realizeProfit(address(usdc), 1 * USDC_DECIMALS);
        vm.stopPrank();
        
        console.log("After +1 profit:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        
        // Net: +5 -2 +1 = +4 USDC
        // Claim redeem
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        uint256 finalBalance = usdc.balanceOf(investor1);
        uint256 netProfit = finalBalance - initialBalance;
        
        console.log("Final balance:", finalBalance / USDC_DECIMALS, "USDC");
        console.log("Net profit:", netProfit / USDC_DECIMALS, "USDC");
        
        // User should get net profit of ~4 USDC (10 + 5 - 2 + 1 = 14)
        assertApproxEqAbs(finalBalance, initialBalance + 4 * USDC_DECIMALS, 1, "Should reflect net profit");
    }

    function test_Fork_ProfitAfterFullCycle_UserKeepsGains() public {
        // Scenario: Deposit → Profit → Redeem (NOT between request/claim)
        uint256 depositAmount = 10 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        uint256 initialBalance = usdc.balanceOf(investor1);
        
        // Full deposit cycle
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        vm.stopPrank();
        
        uint256 sharesAfterDeposit = vault.balanceOf(investor1);
        console.log("After deposit:");
        console.log("  User shares:", sharesAfterDeposit / USDC_DECIMALS, "M");
        
        // Profit happens AFTER deposit is settled
        uint256 profit = 5 * USDC_DECIMALS;
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profit);
        vault.realizeProfit(address(usdc), profit);
        vm.stopPrank();
        
        console.log("After settled deposit + profit:");
        console.log("  Total assets:", vault.totalAssets() / USDC_DECIMALS, "USDC");
        console.log("  User shares:", vault.balanceOf(investor1) / USDC_DECIMALS, "M");
        
        // Full redeem cycle
        uint256 sharesToRedeem = vault.balanceOf(investor1);
        console.log("Attempting to redeem:", sharesToRedeem / USDC_DECIMALS, "M shares");
        
        vm.prank(investor1);
        vault.requestRedeem(sharesToRedeem);
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        uint256 finalBalance = usdc.balanceOf(investor1);
        console.log("Final balance:", finalBalance / USDC_DECIMALS, "USDC");
        
        // User should get profit (10 + 5 = 15 USDC)
        assertApproxEqAbs(finalBalance, initialBalance + profit, 1, "Should keep profit");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PENDING STATE QUERY TESTS (Forked - Real USDC on Sepolia)
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_PendingDepositQuery_BeforeRequest() public {
        // Query before any request
        (uint256 assets, uint256 timestamp, bool fulfilled) = vault.pendingDeposits(investor1);
        
        assertEq(assets, 0, "No assets pending");
        assertEq(timestamp, 0, "No timestamp");
        assertEq(fulfilled, false, "Not fulfilled");
        
        console.log("OK - Pending state query works (empty state)");
    }

    function test_Fork_PendingDepositQuery_AfterRequest() public {
        uint256 depositAmount = 5 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // Request deposit
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        // Query pending state
        (uint256 assets, uint256 timestamp, bool fulfilled) = vault.pendingDeposits(investor1);
        
        console.log("After requestDeposit:");
        console.log("  Assets:", assets / USDC_DECIMALS, "USDC");
        console.log("  Timestamp:", timestamp);
        console.log("  Fulfilled:", fulfilled);
        
        assertEq(assets, depositAmount, "Should have pending assets");
        assertGt(timestamp, 0, "Should have timestamp");
        assertEq(fulfilled, false, "Should not be fulfilled yet");
    }

    function test_Fork_PendingDepositQuery_AfterOperatorClaim() public {
        uint256 depositAmount = 5 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // Request deposit
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        // Operator claims
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // Query after claim
        (uint256 assets, uint256 timestamp, bool fulfilled) = vault.pendingDeposits(investor1);
        
        console.log("After claimDepositFor:");
        console.log("  Assets:", assets / USDC_DECIMALS, "USDC");
        console.log("  Fulfilled:", fulfilled);
        
        assertEq(assets, depositAmount, "Assets still recorded");
        assertGt(timestamp, 0, "Timestamp still recorded");
        assertTrue(fulfilled, "Should be fulfilled");
    }

    function test_Fork_PendingRedeemQuery_AfterRequest() public {
        uint256 depositAmount = 5 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // Setup: Deposit and claim
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vault.claimDeposit();
        
        uint256 shares = vault.balanceOf(investor1);
        
        // Request redeem
        vault.requestRedeem(shares);
        vm.stopPrank();
        
        // Query pending state
        (uint256 pendingShares, uint256 timestamp, bool fulfilled) = vault.pendingRedeems(investor1);
        
        console.log("After requestRedeem:");
        console.log("  Shares:", pendingShares / USDC_DECIMALS, "M");
        console.log("  Timestamp:", timestamp);
        console.log("  Fulfilled:", fulfilled);
        
        assertEq(pendingShares, shares, "Should have pending shares");
        assertGt(timestamp, 0, "Should have timestamp");
        assertEq(fulfilled, false, "Should not be fulfilled yet");
    }

    function test_Fork_PendingQuery_MultipleUsers() public {
        uint256 amount1 = 3 * USDC_DECIMALS;
        uint256 amount2 = 2 * USDC_DECIMALS;
        
        require(usdc.balanceOf(investor1) >= amount1, "Investor1 needs USDC");
        deal(SEPOLIA_USDC, investor2, amount2);
        
        // Both request deposits
        vm.startPrank(investor1);
        usdc.approve(address(vault), amount1);
        vault.requestDeposit(amount1);
        vm.stopPrank();
        
        vm.startPrank(investor2);
        usdc.approve(address(vault), amount2);
        vault.requestDeposit(amount2);
        vm.stopPrank();
        
        // Query both states
        (uint256 assets1, , bool fulfilled1) = vault.pendingDeposits(investor1);
        (uint256 assets2, , bool fulfilled2) = vault.pendingDeposits(investor2);
        
        console.log("Multi-user pending state:");
        console.log("  Investor1:", assets1 / USDC_DECIMALS, "USDC, fulfilled:", fulfilled1);
        console.log("  Investor2:", assets2 / USDC_DECIMALS, "USDC, fulfilled:", fulfilled2);
        
        assertEq(assets1, amount1, "Investor1 pending amount");
        assertEq(assets2, amount2, "Investor2 pending amount");
        assertEq(fulfilled1, false, "Investor1 not fulfilled");
        assertEq(fulfilled2, false, "Investor2 not fulfilled");
        
        // Operator claims only for investor1
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // Query again
        (, , bool fulfilled1After) = vault.pendingDeposits(investor1);
        (, , bool fulfilled2After) = vault.pendingDeposits(investor2);
        
        console.log("After partial claim:");
        console.log("  Investor1 fulfilled:", fulfilled1After);
        console.log("  Investor2 fulfilled:", fulfilled2After);
        
        assertTrue(fulfilled1After, "Investor1 should be fulfilled");
        assertEq(fulfilled2After, false, "Investor2 still pending");
    }

    function test_Fork_BotScenario_DetectPendingAndClaim() public {
        // This simulates what the operator bot does:
        // 1. User requests deposit
        // 2. Bot queries pending state
        // 3. If not fulfilled, bot claims
        
        uint256 depositAmount = 5 * USDC_DECIMALS;
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        
        // User requests deposit
        vm.startPrank(investor1);
        usdc.approve(address(vault), depositAmount);
        vault.requestDeposit(depositAmount);
        vm.stopPrank();
        
        console.log("BOT: BOT SCENARIO: Detecting pending requests...");
        
        // Bot queries pending state (this is what the bot does!)
        (uint256 assets, , bool fulfilled) = vault.pendingDeposits(investor1);
        
        console.log("  Found pending deposit:");
        console.log("    User:", investor1);
        console.log("    Amount:", assets / USDC_DECIMALS, "USDC");
        console.log("    Fulfilled:", fulfilled);
        
        // Bot should detect unfulfilled request
        assertGt(assets, 0, "Bot should detect pending assets");
        assertEq(fulfilled, false, "Bot should detect unfulfilled");
        
        // Bot claims
        console.log("  Bot claiming...");
        vm.prank(operator);
        vault.claimDepositFor(investor1);
        
        // Verify claim worked
        assertEq(vault.balanceOf(investor1), depositAmount, "User should have shares");
        
        // Bot queries again - should now be fulfilled
        (, , bool fulfilledAfter) = vault.pendingDeposits(investor1);
        assertTrue(fulfilledAfter, "Should be fulfilled after claim");
        
        console.log("OK - Bot scenario complete!");
    }
}

