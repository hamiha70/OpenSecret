// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AsyncVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6; // USDC has 6 decimals
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title AsyncVaultTest
 * @notice Comprehensive test suite for AsyncVault
 */
contract AsyncVaultTest is Test {
    AsyncVault public vault;
    MockUSDC public usdc;

    address public owner = address(0x1);
    address public operator = address(0x2);
    address public simulator = address(0x9); // Market simulation bot
    address public user1 = address(0x3);
    address public user2 = address(0x4);

    uint256 constant INITIAL_BALANCE = 10000 * 1e6; // 10,000 USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy vault
        vm.prank(owner);
        vault = new AsyncVault(
            address(usdc),
            operator,
            simulator,
            "Async USDC",
            "asUSDC"
        );

        // Mint USDC to test users and simulator
        usdc.mint(user1, INITIAL_BALANCE);
        usdc.mint(user2, INITIAL_BALANCE);
        usdc.mint(simulator, INITIAL_BALANCE); // Fund simulator for profit simulation

        // Approve vault to spend USDC
        vm.prank(user1);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(user2);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(simulator);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Deployment() public {
        assertEq(address(vault.asset()), address(usdc), "Wrong asset");
        assertEq(vault.operator(), operator, "Wrong operator");
        assertEq(vault.simulator(), simulator, "Wrong simulator");
        assertEq(vault.owner(), owner, "Wrong owner");
        assertEq(vault.decimals(), 6, "Wrong decimals");
        assertEq(vault.name(), "Async USDC", "Wrong name");
        assertEq(vault.symbol(), "asUSDC", "Wrong symbol");
    }

    function test_RevertIf_InvalidAsset() public {
        vm.expectRevert("Invalid asset");
        vm.prank(owner);
        new AsyncVault(address(0), operator, simulator, "Test", "TST");
    }

    function test_RevertIf_InvalidOperator() public {
        vm.expectRevert("Invalid operator");
        vm.prank(owner);
        new AsyncVault(address(usdc), address(0), simulator, "Test", "TST");
    }

    function test_RevertIf_InvalidSimulator() public {
        vm.expectRevert("Invalid simulator");
        vm.prank(owner);
        new AsyncVault(address(usdc), operator, address(0), "Test", "TST");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // DEPOSIT REQUEST TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_RequestDeposit() public {
        uint256 depositAmount = 1000 * 1e6; // 1,000 USDC

        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        // Check USDC transferred to vault
        assertEq(usdc.balanceOf(address(vault)), depositAmount, "USDC not transferred");
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE - depositAmount, "User balance wrong");

        // Check pending request recorded
        (uint256 assets, uint256 timestamp, bool fulfilled) = vault.pendingDeposits(user1);
        assertEq(assets, depositAmount, "Wrong assets");
        assertEq(timestamp, block.timestamp, "Wrong timestamp");
        assertFalse(fulfilled, "Should not be fulfilled");

        // Check view function
        assertEq(vault.pendingDepositRequest(user1), depositAmount, "pendingDepositRequest wrong");
    }

    function test_RevertIf_DepositZero() public {
        vm.prank(user1);
        vm.expectRevert("Zero deposit");
        vault.requestDeposit(0);
    }

    function test_RevertIf_DepositWithoutApproval() public {
        address user3 = address(0x5);
        usdc.mint(user3, 1000 * 1e6);

        vm.prank(user3);
        vm.expectRevert();
        vault.requestDeposit(1000 * 1e6);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // CLAIM DEPOSIT TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_ClaimDeposit() public {
        uint256 depositAmount = 1000 * 1e6; // 1,000 USDC

        // Request deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        // Operator claims deposit
        vm.prank(operator);
        vault.claimDepositFor(user1);

        // Check shares minted
        assertEq(vault.balanceOf(user1), depositAmount, "Shares not minted");

        // Check request fulfilled
        (,, bool fulfilled) = vault.pendingDeposits(user1);
        assertTrue(fulfilled, "Should be fulfilled");

        // Check view function returns 0
        assertEq(vault.pendingDepositRequest(user1), 0, "Should have no pending request");
    }

    function test_ClaimDeposit_UserCanClaimOwnDeposit() public {
        uint256 depositAmount = 1000 * 1e6;

        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        // User can claim their own deposit
        vm.prank(user1);
        vault.claimDeposit();

        assertEq(vault.balanceOf(user1), depositAmount, "Shares not minted");
    }

    function test_RevertIf_ClaimDepositNoPending() public {
        vm.prank(operator);
        vm.expectRevert("No pending deposit");
        vault.claimDepositFor(user1);
    }

    function test_RevertIf_ClaimDepositAlreadyFulfilled() public {
        uint256 depositAmount = 1000 * 1e6;

        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        vm.prank(operator);
        vault.claimDepositFor(user1);

        // Try to claim again
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimDepositFor(user1);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // REDEEM REQUEST TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_RequestRedeem() public {
        uint256 depositAmount = 1000 * 1e6;

        // First deposit and claim
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Check shares NOT burned yet (Centrifuge pattern - burn at claim time)
        assertEq(vault.balanceOf(user1), shares, "Shares should not be burned yet");

        // Check pending request recorded
        (uint256 pendingShares, uint256 timestamp, bool fulfilled) = vault.pendingRedeems(user1);
        assertEq(pendingShares, shares, "Wrong shares");
        assertEq(timestamp, block.timestamp, "Wrong timestamp");
        assertFalse(fulfilled, "Should not be fulfilled");

        // Check view function
        assertEq(vault.pendingRedeemRequest(user1), shares, "pendingRedeemRequest wrong");
    }

    function test_RevertIf_RedeemZero() public {
        vm.prank(user1);
        vm.expectRevert("Zero redeem");
        vault.requestRedeem(0);
    }

    function test_RevertIf_RedeemInsufficientShares() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient shares");
        vault.requestRedeem(1000 * 1e6);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // CLAIM REDEEM TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_ClaimRedeem() public {
        uint256 depositAmount = 1000 * 1e6;

        // Deposit and claim
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        uint256 balanceBefore = usdc.balanceOf(user1);

        // Operator claims redeem
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // Check USDC returned
        assertEq(usdc.balanceOf(user1), balanceBefore + depositAmount, "USDC not returned");

        // Check request fulfilled
        (,, bool fulfilled) = vault.pendingRedeems(user1);
        assertTrue(fulfilled, "Should be fulfilled");

        // Check view function returns 0
        assertEq(vault.pendingRedeemRequest(user1), 0, "Should have no pending request");
    }

    function test_RevertIf_ClaimRedeemNoPending() public {
        vm.prank(operator);
        vm.expectRevert("No pending redeem");
        vault.claimRedeemFor(user1);
    }

    function test_RevertIf_ClaimRedeemAlreadyFulfilled() public {
        uint256 depositAmount = 1000 * 1e6;

        // First deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Claim redeem
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // Deposit again to get shares for another redeem request
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        shares = vault.balanceOf(user1);

        // Request another redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Claim it
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // Try to claim the same request again
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimRedeemFor(user1);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // CONVERSION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_ConvertToShares_Bootstrap() public {
        uint256 assets = 1000 * 1e6;
        uint256 shares = vault.convertToShares(assets);
        assertEq(shares, assets, "Bootstrap conversion should be 1:1");
    }

    function test_ConvertToAssets_Bootstrap() public {
        uint256 shares = 1000 * 1e6;
        uint256 assets = vault.convertToAssets(shares);
        assertEq(assets, shares, "Bootstrap conversion should be 1:1");
    }

    function test_TotalAssets() public {
        uint256 depositAmount = 1000 * 1e6;

        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        assertEq(vault.totalAssets(), depositAmount, "Total assets should equal deposit");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_SetOperator() public {
        address newOperator = address(0x99);

        vm.prank(owner);
        vault.setOperator(newOperator);

        assertEq(vault.operator(), newOperator, "Operator not updated");
    }

    function test_RevertIf_SetOperatorNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setOperator(address(0x99));
    }

    function test_RevertIf_SetOperatorZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid operator");
        vault.setOperator(address(0));
    }

    // Removed test_SetStrategy() - strategy functionality removed from contract

    // ═════════════════════════════════════════════════════════════════════════════
    // FULL FLOW INTEGRATION TEST
    // ═════════════════════════════════════════════════════════════════════════════

    function test_FullDepositRedeemFlow() public {
        uint256 depositAmount = 5000 * 1e6; // 5,000 USDC

        // 1. User1 requests deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        // 2. Operator claims deposit (mints shares)
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);
        assertEq(shares, depositAmount, "Shares should equal deposit (1:1)");

        // 3. User1 requests redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Shares NOT burned yet (Centrifuge pattern - burn at claim time)
        assertEq(vault.balanceOf(user1), shares, "Shares should not be burned yet");

        // 4. Operator claims redeem (returns USDC)
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE, "User should get all USDC back");
    }

    function test_MultipleUsersDeposit() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 2000 * 1e6;

        // User1 deposits (bootstrap case: gets 1:1)
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        assertEq(vault.balanceOf(user1), deposit1, "User1 shares wrong");
        
        // Calculate expected shares for User2 BEFORE their deposit
        // At this point: totalSupply = 1000e6, totalAssets = 1000e6
        // shares = (2000e6 * 1000e6) / 1000e6 = 2000e6
        uint256 expectedShares2 = (deposit2 * vault.totalSupply()) / vault.totalAssets();
        
        // User2 deposits
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        vm.prank(operator);
        vault.claimDepositFor(user2);

        // Check User2 got expected shares
        assertEq(vault.balanceOf(user2), expectedShares2, "User2 shares wrong");
        
        assertEq(vault.totalAssets(), deposit1 + deposit2, "Total assets wrong");
        assertEq(vault.totalSupply(), deposit1 + deposit2, "Total supply wrong"); // 1:1 pricing means supply = assets
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PROFIT/LOSS REALIZATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_RealizeProfit() public {
        uint256 depositAmount = 1000 * 1e6; // 1,000 USDC
        uint256 profitAmount = 50 * 1e6;    // 50 USDC profit (5%)

        // Setup: User deposits
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        // Initial state
        assertEq(vault.totalAssets(), depositAmount, "Initial total assets");
        assertEq(vault.convertToAssets(depositAmount), depositAmount, "Initial conversion 1:1");

        // Simulator realizes profit (transfers USDC then calls realizeProfit for event)
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profitAmount); // Transfer profit to vault
        vault.realizeProfit(address(usdc), profitAmount);
        vm.stopPrank();

        // Check state after profit - balance increased automatically!
        assertEq(vault.totalAssets(), depositAmount + profitAmount, "Total assets increased");
        
        // Share price increased: 1000 shares now worth 1050 USDC
        uint256 shareValue = vault.convertToAssets(depositAmount);
        assertEq(shareValue, depositAmount + profitAmount, "Share price increased");

        // User redeems and gets profit
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User received profit!
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE + profitAmount, "User got profit!");
    }

    function test_RealizeLoss() public {
        uint256 depositAmount = 1000 * 1e6; // 1,000 USDC
        uint256 lossAmount = 30 * 1e6;      // 30 USDC loss (3%)

        // Setup: User deposits
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        assertEq(vault.totalAssets(), depositAmount);

        // Simulator realizes loss
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), lossAmount);

        // Check state after loss - balance decreased automatically!
        assertEq(vault.totalAssets(), depositAmount - lossAmount, "Total assets decreased");
        assertEq(usdc.balanceOf(simulator), INITIAL_BALANCE + lossAmount, "Simulator received loss");

        // Share price decreased: 1000 shares now worth 970 USDC
        uint256 shareValue = vault.convertToAssets(depositAmount);
        assertEq(shareValue, depositAmount - lossAmount, "Share price decreased");

        // User redeems and gets less
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User received less due to loss
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE - lossAmount, "User took loss");
    }

    function test_RealizeProfitAndLoss_Combined() public {
        uint256 depositAmount = 1000 * 1e6;

        // Setup
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        // Realize 5% profit
        vm.startPrank(simulator);
        usdc.transfer(address(vault), 50 * 1e6);
        vault.realizeProfit(address(usdc), 50 * 1e6);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 1050 * 1e6, "Total after profit");

        // Realize 2% loss
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), 20 * 1e6);

        assertEq(vault.totalAssets(), 1030 * 1e6, "Total after loss (net +3%)");

        // User redeems and gets net profit
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE + 30 * 1e6, "User got net profit");
    }

    function test_RevertIf_RealizeProfitNotSimulator() public {
        vm.prank(user1);
        vm.expectRevert("Only simulator");
        vault.realizeProfit(address(usdc), 10 * 1e6);
    }

    function test_RevertIf_RealizeLossNotSimulator() public {
        vm.prank(user1);
        vm.expectRevert("Only simulator");
        vault.realizeLoss(address(usdc), 10 * 1e6);
    }

    function test_RevertIf_RealizeProfitWrongToken() public {
        address wrongToken = address(0x999);
        
        vm.prank(simulator);
        vm.expectRevert("Wrong token");
        vault.realizeProfit(wrongToken, 10 * 1e6);
    }

    function test_RevertIf_RealizeLossWrongToken() public {
        address wrongToken = address(0x999);
        
        vm.prank(simulator);
        vm.expectRevert("Wrong token");
        vault.realizeLoss(wrongToken, 10 * 1e6);
    }

    function test_RevertIf_RealizeProfitZeroAmount() public {
        vm.prank(simulator);
        vm.expectRevert("Zero amount");
        vault.realizeProfit(address(usdc), 0);
    }

    function test_RevertIf_RealizeLossZeroAmount() public {
        vm.prank(simulator);
        vm.expectRevert("Zero amount");
        vault.realizeLoss(address(usdc), 0);
    }

    function test_RevertIf_RealizeLossInsufficientBalance() public {
        // Try to realize loss with empty vault
        vm.prank(simulator);
        vm.expectRevert("Insufficient balance");
        vault.realizeLoss(address(usdc), 100 * 1e6);
    }

    function test_MultipleUsersWithProfit() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 2000 * 1e6;

        // User1 deposits
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        // User2 deposits
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        vm.prank(operator);
        vault.claimDepositFor(user2);

        // Both users have shares
        uint256 shares1 = vault.balanceOf(user1);
        uint256 shares2 = vault.balanceOf(user2);

        // Realize 10% profit on total assets
        uint256 profitAmount = 300 * 1e6; // 10% of 3000
        vm.startPrank(simulator);
        usdc.transfer(address(vault), profitAmount);
        vault.realizeProfit(address(usdc), profitAmount);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 3300 * 1e6, "Total with profit");

        // User1 redeems (should get proportional profit)
        vm.prank(user1);
        vault.requestRedeem(shares1);
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User1 deposited 1000, gets 1100 (10% profit)
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE + 100 * 1e6, "User1 got profit");

        // User2 redeems
        vm.prank(user2);
        vault.requestRedeem(shares2);
        vm.prank(operator);
        vault.claimRedeemFor(user2);

        // User2 deposited 2000, gets 2200 (10% profit)
        assertEq(usdc.balanceOf(user2), INITIAL_BALANCE + 200 * 1e6, "User2 got profit");
    }

    function test_SetSimulator() public {
        address newSimulator = address(0x888);

        vm.prank(owner);
        vault.setSimulator(newSimulator);

        assertEq(vault.simulator(), newSimulator, "Simulator updated");
    }

    function test_RevertIf_SetSimulatorNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setSimulator(address(0x888));
    }

    function test_RevertIf_SetSimulatorZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid simulator");
        vault.setSimulator(address(0));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PROFIT/LOSS BETWEEN REQUEST AND CLAIM TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_ProfitBetweenRequestAndClaim_UserGetsDynamicValue() public {
        uint256 depositAmount = 1000 * 1e6;

        // Setup: User deposits
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);

        // User requests redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // PROFIT HAPPENS BETWEEN REQUEST AND CLAIM (Centrifuge pattern: user benefits!)
        vm.startPrank(simulator);
        usdc.transfer(address(vault), 50 * 1e6); // +5% profit
        vault.realizeProfit(address(usdc), 50 * 1e6);
        vm.stopPrank();

        // Vault now has 1050 USDC
        assertEq(vault.totalAssets(), 1050 * 1e6, "Vault has profit");

        // User claims redeem (gets current share value - Centrifuge pattern!)
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User gets CURRENT value (1050 USDC) because calculation happens at claim time!
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE + 50 * 1e6, "User gets current value with profit");
        
        // Vault is empty
        assertEq(vault.totalAssets(), 0, "Vault is empty");
    }

    function test_LossBetweenRequestAndClaim_UserGetsDynamicValue() public {
        uint256 depositAmount = 1000 * 1e6;

        // Setup: User deposits
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);

        uint256 shares = vault.balanceOf(user1);

        // User requests redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // LOSS HAPPENS BETWEEN REQUEST AND CLAIM (Centrifuge pattern: user bears the loss!)
        vm.prank(simulator);
        vault.realizeLoss(address(usdc), 30 * 1e6); // -3% loss

        // Vault now has 970 USDC
        assertEq(vault.totalAssets(), 970 * 1e6, "Vault has loss");

        // User claims redeem (gets current share value - Centrifuge pattern!)
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User gets CURRENT value (970 USDC) because calculation happens at claim time!
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE - 30 * 1e6, "User bears the loss");
        
        // Vault is empty
        assertEq(vault.totalAssets(), 0, "Vault is empty");
    }

    function test_MultipleUsersWithProfitBetweenRequestAndClaim() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 1000 * 1e6;

        // User1 and User2 both deposit
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        
        vm.prank(operator);
        vault.claimDepositFor(user1);
        vm.prank(operator);
        vault.claimDepositFor(user2);

        // Both have 1000 shares (total supply = 2000, total assets = 2000)
        assertEq(vault.balanceOf(user1), 1000 * 1e6);
        assertEq(vault.balanceOf(user2), 1000 * 1e6);

        // User1 requests redeem FIRST
        vm.prank(user1);
        vault.requestRedeem(1000 * 1e6);

        // PROFIT happens AFTER user1 request but BEFORE user1 claim (Centrifuge: user1 gets profit!)
        vm.startPrank(simulator);
        usdc.transfer(address(vault), 100 * 1e6); // +100 USDC profit
        vault.realizeProfit(address(usdc), 100 * 1e6);
        vm.stopPrank();

        // Now totalAssets = 2100, totalSupply = 2000 (shares NOT burned at request!)
        // User1's 1000 shares worth: 1000 * 2100 / 2000 = 1050 USDC
        assertEq(vault.totalAssets(), 2100 * 1e6, "Vault has profit");

        // User1 claims (gets proportional profit because Centrifuge pattern calculates at claim time!)
        vm.prank(operator);
        vault.claimRedeemFor(user1);

        // User1 gets 1050 USDC (their proportional share of profit: 50% of 100 USDC profit = 50 USDC)
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE + 50 * 1e6, "User1 gets profit");
        
        // Vault has 1050 USDC left (user2 still has 1000 shares worth 1050 USDC)
        assertEq(vault.totalAssets(), 1050 * 1e6, "Vault has assets for user2");
        assertEq(vault.balanceOf(user2), 1000 * 1e6, "User2 still has shares");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // OPERATOR PATTERN ACCESS CONTROL TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_RevertIf_ClaimDepositFor_NotOperator() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // User1 requests deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        
        // user2 (not operator) tries to claim for user1
        vm.prank(user2);
        vm.expectRevert("Only operator");
        vault.claimDepositFor(user1);
    }

    function test_RevertIf_ClaimDepositFor_UserTriesToClaimForOther() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // User1 requests deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        
        // User2 requests their own deposit
        vm.prank(user2);
        vault.requestDeposit(depositAmount);
        
        // User1 tries to claim for User2 (should fail)
        vm.prank(user1);
        vm.expectRevert("Only operator");
        vault.claimDepositFor(user2);
        
        // User1 can claim their own via claimDeposit()
        vm.prank(user1);
        vault.claimDeposit(); // This should work
    }

    function test_RevertIf_ClaimRedeemFor_NotOperator() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // Setup: user1 deposits and gets shares
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        // User1 requests redeem
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        // user2 (not operator) tries to claim redeem for user1
        vm.prank(user2);
        vm.expectRevert("Only operator");
        vault.claimRedeemFor(user1);
    }

    function test_RevertIf_ClaimRedeemFor_UserTriesToClaimForOther() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // Setup: both users deposit and get shares
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        vm.prank(user2);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user2);
        
        // Both users request redeem
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        vm.prank(user2);
        vault.requestRedeem(depositAmount);
        
        // User1 tries to claim for User2 (should fail)
        vm.prank(user1);
        vm.expectRevert("Only operator");
        vault.claimRedeemFor(user2);
        
        // User1 can claim their own via claimRedeem()
        vm.prank(user1);
        vault.claimRedeem(); // This should work
    }

    function test_ClaimDepositFor_OperatorCanClaimForMultipleUsers() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // User1 requests and claims first (bootstrap: 1:1 ratio)
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        // User2 requests and claims (should get same shares at 1:1 ratio)
        vm.prank(user2);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user2);
        
        // User3 requests and claims (should get same shares at 1:1 ratio)
        address user3 = makeAddr("user3");
        usdc.mint(user3, INITIAL_BALANCE);
        vm.prank(user3);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(user3);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user3);
        
        // Verify all got same shares (1:1 ratio maintained)
        assertEq(vault.balanceOf(user1), depositAmount, "User1 got shares");
        assertEq(vault.balanceOf(user2), depositAmount, "User2 got shares");
        assertEq(vault.balanceOf(user3), depositAmount, "User3 got shares");
    }

    function test_ClaimRedeemFor_OperatorCanClaimForMultipleUsers() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // Setup: multiple users deposit and get shares
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        vm.prank(user2);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user2);
        
        address user3 = makeAddr("user3");
        usdc.mint(user3, INITIAL_BALANCE);
        vm.prank(user3);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(user3);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user3);
        
        // All users request redeem
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        vm.prank(user2);
        vault.requestRedeem(depositAmount);
        
        vm.prank(user3);
        vault.requestRedeem(depositAmount);
        
        // Operator claims for all users
        vm.startPrank(operator);
        vault.claimRedeemFor(user1);
        vault.claimRedeemFor(user2);
        vault.claimRedeemFor(user3);
        vm.stopPrank();
        
        // Verify all got USDC back
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE, "User1 got USDC back");
        assertEq(usdc.balanceOf(user2), INITIAL_BALANCE, "User2 got USDC back");
        assertEq(usdc.balanceOf(user3), INITIAL_BALANCE, "User3 got USDC back");
    }

    function test_ClaimDeposit_UserSelfClaimUsesMsgSender() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 2000 * 1e6;
        
        // Both users request deposits
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        
        // Each user claims their own (no address parameter needed)
        vm.prank(user1);
        vault.claimDeposit(); // Claims user1's deposit automatically
        
        vm.prank(user2);
        vault.claimDeposit(); // Claims user2's deposit automatically
        
        // Verify correct amounts
        assertEq(vault.balanceOf(user1), deposit1, "User1 got correct shares");
        assertEq(vault.balanceOf(user2), deposit2, "User2 got correct shares");
    }

    function test_ClaimRedeem_UserSelfClaimUsesMsgSender() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 2000 * 1e6;
        
        // Setup: both users deposit
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        vm.prank(operator);
        vault.claimDepositFor(user2);
        
        // Both users request redeem
        vm.prank(user1);
        vault.requestRedeem(deposit1);
        
        vm.prank(user2);
        vault.requestRedeem(deposit2);
        
        // Each user claims their own (no address parameter needed)
        vm.prank(user1);
        vault.claimRedeem(); // Claims user1's redeem automatically
        
        vm.prank(user2);
        vault.claimRedeem(); // Claims user2's redeem automatically
        
        // Verify correct amounts
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE, "User1 got USDC back");
        assertEq(usdc.balanceOf(user2), INITIAL_BALANCE, "User2 got USDC back");
    }

    function test_ClaimDeposit_RaceCondition_FirstClaimWins() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // User requests deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        
        // User claims first
        vm.prank(user1);
        vault.claimDeposit();
        
        // Operator tries to claim (should fail - already fulfilled)
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimDepositFor(user1);
        
        // Verify user got shares
        assertEq(vault.balanceOf(user1), depositAmount, "User got shares");
    }

    function test_ClaimRedeem_RaceCondition_FirstClaimWins() public {
        uint256 depositAmount = 1000 * 1e6;
        
        // Setup: user deposits
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDepositFor(user1);
        
        // User requests redeem
        vm.prank(user1);
        vault.requestRedeem(depositAmount);
        
        // Operator claims first
        vm.prank(operator);
        vault.claimRedeemFor(user1);
        
        // User tries to claim (should fail - already fulfilled)
        vm.prank(user1);
        vm.expectRevert("Already fulfilled");
        vault.claimRedeem();
        
        // Verify user got USDC back
        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE, "User got USDC back");
    }
}

