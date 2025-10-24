// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/OmniVault.sol";
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
 * @title OmniVaultTest
 * @notice Comprehensive test suite for OmniVault
 */
contract OmniVaultTest is Test {
    OmniVault public vault;
    MockUSDC public usdc;

    address public owner = address(0x1);
    address public operator = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);

    uint256 constant INITIAL_BALANCE = 10000 * 1e6; // 10,000 USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy vault
        vm.prank(owner);
        vault = new OmniVault(
            address(usdc),
            operator,
            "OmniVault USDC",
            "ovUSDC"
        );

        // Mint USDC to test users
        usdc.mint(user1, INITIAL_BALANCE);
        usdc.mint(user2, INITIAL_BALANCE);

        // Approve vault to spend USDC
        vm.prank(user1);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(user2);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    function test_Deployment() public {
        assertEq(address(vault.asset()), address(usdc), "Wrong asset");
        assertEq(vault.operator(), operator, "Wrong operator");
        assertEq(vault.owner(), owner, "Wrong owner");
        assertEq(vault.decimals(), 6, "Wrong decimals");
        assertEq(vault.name(), "OmniVault USDC", "Wrong name");
        assertEq(vault.symbol(), "ovUSDC", "Wrong symbol");
    }

    function test_RevertIf_InvalidAsset() public {
        vm.expectRevert("Invalid asset");
        vm.prank(owner);
        new OmniVault(address(0), operator, "Test", "TST");
    }

    function test_RevertIf_InvalidOperator() public {
        vm.expectRevert("Invalid operator");
        vm.prank(owner);
        new OmniVault(address(usdc), address(0), "Test", "TST");
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
        vault.claimDeposit(user1);

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
        vault.claimDeposit(user1);

        assertEq(vault.balanceOf(user1), depositAmount, "Shares not minted");
    }

    function test_RevertIf_ClaimDepositNoPending() public {
        vm.prank(operator);
        vm.expectRevert("No pending deposit");
        vault.claimDeposit(user1);
    }

    function test_RevertIf_ClaimDepositAlreadyFulfilled() public {
        uint256 depositAmount = 1000 * 1e6;

        vm.prank(user1);
        vault.requestDeposit(depositAmount);

        vm.prank(operator);
        vault.claimDeposit(user1);

        // Try to claim again
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimDeposit(user1);
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
        vault.claimDeposit(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Check shares burned
        assertEq(vault.balanceOf(user1), 0, "Shares not burned");

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
        vault.claimDeposit(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        uint256 balanceBefore = usdc.balanceOf(user1);

        // Operator claims redeem
        vm.prank(operator);
        vault.claimRedeem(user1);

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
        vault.claimRedeem(user1);
    }

    function test_RevertIf_ClaimRedeemAlreadyFulfilled() public {
        uint256 depositAmount = 1000 * 1e6;

        // First deposit
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDeposit(user1);

        uint256 shares = vault.balanceOf(user1);

        // Request redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Claim redeem
        vm.prank(operator);
        vault.claimRedeem(user1);

        // Deposit again to get shares for another redeem request
        vm.prank(user1);
        vault.requestDeposit(depositAmount);
        vm.prank(operator);
        vault.claimDeposit(user1);

        shares = vault.balanceOf(user1);

        // Request another redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        // Claim it
        vm.prank(operator);
        vault.claimRedeem(user1);

        // Try to claim the same request again
        vm.prank(operator);
        vm.expectRevert("Already fulfilled");
        vault.claimRedeem(user1);
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

    function test_SetStrategy() public {
        address mockStrategy = address(0x88);

        vm.prank(owner);
        vault.setStrategy(mockStrategy);

        assertEq(vault.strategy(), mockStrategy, "Strategy not updated");
    }

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
        vault.claimDeposit(user1);

        uint256 shares = vault.balanceOf(user1);
        assertEq(shares, depositAmount, "Shares should equal deposit (1:1)");

        // 3. User1 requests redeem
        vm.prank(user1);
        vault.requestRedeem(shares);

        assertEq(vault.balanceOf(user1), 0, "Shares should be burned");

        // 4. Operator claims redeem (returns USDC)
        vm.prank(operator);
        vault.claimRedeem(user1);

        assertEq(usdc.balanceOf(user1), INITIAL_BALANCE, "User should get all USDC back");
    }

    function test_MultipleUsersDeposit() public {
        uint256 deposit1 = 1000 * 1e6;
        uint256 deposit2 = 2000 * 1e6;

        // User1 deposits (bootstrap case: gets 1:1)
        vm.prank(user1);
        vault.requestDeposit(deposit1);
        vm.prank(operator);
        vault.claimDeposit(user1);

        assertEq(vault.balanceOf(user1), deposit1, "User1 shares wrong");
        
        // Calculate expected shares for User2 BEFORE their deposit
        // At this point: totalSupply = 1000e6, totalAssets = 1000e6
        // shares = (2000e6 * 1000e6) / 1000e6 = 2000e6
        uint256 expectedShares2 = (deposit2 * vault.totalSupply()) / vault.totalAssets();
        
        // User2 deposits
        vm.prank(user2);
        vault.requestDeposit(deposit2);
        vm.prank(operator);
        vault.claimDeposit(user2);

        // Check User2 got expected shares
        assertEq(vault.balanceOf(user2), expectedShares2, "User2 shares wrong");
        
        assertEq(vault.totalAssets(), deposit1 + deposit2, "Total assets wrong");
        assertEq(vault.totalSupply(), deposit1 + deposit2, "Total supply wrong"); // 1:1 pricing means supply = assets
    }
}

