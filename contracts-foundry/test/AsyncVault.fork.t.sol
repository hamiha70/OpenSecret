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
        // Fork Sepolia at latest block
        vm.createSelectFork(vm.rpcUrl("sepolia"));
        
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
        uint256 amount = 10 * USDC_DECIMALS; // 10 USDC
        
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
        uint256 depositAmount = 10 * USDC_DECIMALS; // 10 USDC
        
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
        uint256 amount = 5 * USDC_DECIMALS; // 5 USDC each
        
        require(usdc.balanceOf(investor1) >= amount, "Investor1 needs USDC");
        
        // Give investor2 some USDC (simulate faucet)
        deal(SEPOLIA_USDC, investor2, 1000 * USDC_DECIMALS);
        
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
        uint256 amount = 5 * USDC_DECIMALS;
        
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
        uint256 amount = 5 * USDC_DECIMALS;
        
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
        uint256 depositAmount = 100 * USDC_DECIMALS;
        uint256 profitAmount = 10 * USDC_DECIMALS; // 10% profit
        
        require(usdc.balanceOf(investor1) >= depositAmount, "Need USDC");
        require(usdc.balanceOf(simulator) >= profitAmount, "Simulator needs USDC for profit");
        
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
        
        // Should get original + profit (±1 wei)
        assertApproxEqAbs(
            usdc.balanceOf(investor1), 
            profitAmount, // Started with 0 after deposit
            1, 
            "Should receive profit"
        );
    }

    function test_Fork_SimulatorCanRealizeLoss() public {
        uint256 depositAmount = 100 * USDC_DECIMALS;
        uint256 lossAmount = 5 * USDC_DECIMALS; // 5% loss
        
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
        uint256 deposit1 = 60 * USDC_DECIMALS; // 60% of deposits
        uint256 deposit2 = 40 * USDC_DECIMALS; // 40% of deposits
        uint256 profit = 10 * USDC_DECIMALS;   // 10 USDC profit
        
        require(usdc.balanceOf(investor1) >= deposit1, "Investor1 needs USDC");
        deal(SEPOLIA_USDC, investor2, 1000 * USDC_DECIMALS);
        require(usdc.balanceOf(simulator) >= profit, "Simulator needs USDC");
        
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
        
        // Both redeem
        vm.prank(investor1);
        vault.requestRedeem(vault.balanceOf(investor1));
        vm.prank(operator);
        vault.claimRedeemFor(investor1);
        
        vm.prank(investor2);
        vault.requestRedeem(vault.balanceOf(investor2));
        vm.prank(operator);
        vault.claimRedeemFor(investor2);
        
        // Check proportional profit
        // Investor1: 60% of 10 USDC = 6 USDC profit
        // Investor2: 40% of 10 USDC = 4 USDC profit
        console.log("Final balances:");
        console.log("  Investor1:", usdc.balanceOf(investor1) / USDC_DECIMALS, "USDC (should be ~6 profit)");
        console.log("  Investor2:", usdc.balanceOf(investor2) / USDC_DECIMALS - 1000, "USDC (should be ~4 profit)");
        
        assertApproxEqAbs(usdc.balanceOf(investor1), 6 * USDC_DECIMALS, 1, "Investor1 60% profit");
        assertApproxEqAbs(usdc.balanceOf(investor2), 1004 * USDC_DECIMALS, 1, "Investor2 40% profit");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // GAS BENCHMARKS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Fork_GasBenchmark_DepositAndClaim() public {
        uint256 amount = 10 * USDC_DECIMALS;
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
}

