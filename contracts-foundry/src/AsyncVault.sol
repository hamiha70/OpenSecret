// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IOperator} from "./interfaces/IOperator.sol";
import {IProfitLossRealizer} from "./interfaces/IProfitLossRealizer.sol";

/**
 * @title AsyncVault
 * @notice ERC-7540 Asynchronous Vault extending ERC-4626
 * @dev Built on OpenZeppelin ERC4626 with async extensions following Centrifuge pattern
 * 
 * Standards Compliance:
 * - ERC-20: Token standard (via ERC4626)
 * - ERC-4626: Tokenized vault standard (inherited from OpenZeppelin)
 * - ERC-7540: Async deposit/redeem extensions (our implementation)
 * 
 * Architecture:
 * - Inherits ERC4626 for standard vault functions (deposit, withdraw, totalAssets, etc.)
 * - Extends with ERC-7540 async pattern (requestDeposit/requestRedeem + claim functions)
 * - Operator pattern for automated claiming (no user interaction needed)
 * - Market bot simulates profit/loss via IProfitLossRealizer
 * - Integrates with Avail Nexus for cross-chain user onboarding
 * 
 * UX Flow:
 * 1. User bridges USDC via Avail Nexus (from any chain to Sepolia)
 * 2. User calls requestDeposit (1 tx)
 * 3. Operator bot auto-claims (0 additional user txs)
 * 4. Market bot simulates profit/loss → share price changes dynamically
 * 5. User receives shares with current market value (Centrifuge pattern)
 */
contract AsyncVault is ERC4626, Ownable, IOperator, IProfitLossRealizer {
    using SafeERC20 for IERC20;

    // ═════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES (ERC-7540 Extensions)
    // ═════════════════════════════════════════════════════════════════════════════
    // Note: asset, totalAssets(), convertTo*() are inherited from ERC4626

    /// @notice Trusted operator who can fulfill requests on behalf of users
    address public operator;

    /// @notice Market simulation bot authorized to realize profit/loss
    address public simulator;

    // ERC-7540 Request tracking
    struct DepositRequest {
        uint256 assets;        // Amount of USDC to deposit
        uint256 timestamp;     // When request was made
        bool fulfilled;        // Whether operator has processed it
    }

    struct RedeemRequest {
        uint256 shares;        // Amount of shares to redeem
        uint256 timestamp;     // When request was made
        bool fulfilled;        // Whether operator has processed it
    }
    // NOTE: We follow Centrifuge's pattern - assets are calculated at CLAIM time, not request time.
    // This avoids race conditions and underfunding in multi-user scenarios.

    /// @notice Pending deposit requests by user
    mapping(address => DepositRequest) public pendingDeposits;

    /// @notice Pending redeem requests by user
    mapping(address => RedeemRequest) public pendingRedeems;

    // ═════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═════════════════════════════════════════════════════════════════════════════

    event DepositRequested(address indexed user, uint256 assets, uint256 timestamp);
    event DepositClaimed(address indexed user, uint256 assets, uint256 shares);
    event RedeemRequested(address indexed user, uint256 shares, uint256 timestamp);
    event RedeemClaimed(address indexed user, uint256 shares, uint256 assets);
    event SimulatorUpdated(address indexed oldSimulator, address indexed newSimulator);
    // OperatorUpdated is declared in IOperator interface

    // ═════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @param _asset The underlying asset (USDC address on Sepolia)
     * @param _operator The trusted operator address
     * @param _simulator The market simulation bot address
     * @param _name ERC20 token name (e.g., "AsyncVault USDC")
     * @param _symbol ERC20 token symbol (e.g., "asUSDC")
     */
    constructor(
        address _asset,
        address _operator,
        address _simulator,
        string memory _name,
        string memory _symbol
    ) 
        ERC4626(IERC20(_asset))  // Pass asset to ERC4626
        ERC20(_name, _symbol)    // ERC4626 calls ERC20 constructor
        Ownable(msg.sender) 
    {
        require(_asset != address(0), "Invalid asset");
        require(_operator != address(0), "Invalid operator");
        require(_simulator != address(0), "Invalid simulator");

        operator = _operator;
        simulator = _simulator;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═════════════════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    modifier onlySimulator() {
        require(msg.sender == simulator, "Only simulator");
        _;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // ERC-7540: ASYNC DEPOSIT FLOW
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Request to deposit USDC into the vault
     * @param assets Amount of USDC to deposit
     * @dev User must approve vault to spend USDC first
     */
    function requestDeposit(uint256 assets) external {
        require(assets > 0, "Zero deposit");
        
        // Check if there's an unfulfilled pending request
        DepositRequest storage existing = pendingDeposits[msg.sender];
        require(existing.assets == 0 || existing.fulfilled, "Pending request exists");

        // Transfer USDC from user to vault
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        // Record the pending request
        pendingDeposits[msg.sender] = DepositRequest({
            assets: assets,
            timestamp: block.timestamp,
            fulfilled: false
        });

        emit DepositRequested(msg.sender, assets, block.timestamp);
    }

    /**
     * @notice User claims their own deposit (mints shares)
     * @dev Standard ERC-7540: User calls with no parameters, uses msg.sender
     */
    function claimDeposit() external {
        _claimDeposit(msg.sender);
    }

    /**
     * @dev Internal function to process deposit claim
     */
    function _claimDeposit(address user) internal {
        DepositRequest storage request = pendingDeposits[user];
        require(request.assets > 0, "No pending deposit");
        require(!request.fulfilled, "Already fulfilled");

        // Calculate shares to mint based on snapshot BEFORE this user's deposit
        // We need to subtract the user's assets from totalAssets to get the "before" state
        uint256 totalAssetsBeforeDeposit = totalAssets() - request.assets;
        uint256 shares;
        
        if (totalSupply() == 0 || totalAssetsBeforeDeposit == 0) {
            // Bootstrap case: 1:1
            shares = request.assets;
        } else {
            // Normal case: proportional to existing shares
            shares = (request.assets * totalSupply()) / totalAssetsBeforeDeposit;
        }

        // Mark as fulfilled
        request.fulfilled = true;

        // Mint shares to user
        _mint(user, shares);

        emit DepositClaimed(user, request.assets, shares);
    }

    /**
     * @notice Check if user has a pending deposit that can be claimed
     * @param user Address to check
     * @return assets Amount of assets pending, 0 if none
     */
    function pendingDepositRequest(address user) external view returns (uint256 assets) {
        DepositRequest memory request = pendingDeposits[user];
        return (!request.fulfilled && request.assets > 0) ? request.assets : 0;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // ERC-7540: ASYNC REDEEM FLOW
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Request to redeem shares for USDC
     * @param shares Amount of shares to redeem
     */
    function requestRedeem(uint256 shares) external {
        require(shares > 0, "Zero redeem");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        // Check if there's an unfulfilled pending request
        RedeemRequest storage existing = pendingRedeems[msg.sender];
        require(existing.shares == 0 || existing.fulfilled, "Pending request exists");

        // Record the pending request (shares will be burned at claim time - Centrifuge pattern)
        // This keeps totalSupply accurate for share price calculations
        pendingRedeems[msg.sender] = RedeemRequest({
            shares: shares,
            timestamp: block.timestamp,
            fulfilled: false
        });

        emit RedeemRequested(msg.sender, shares, block.timestamp);
    }

    /**
     * @notice User claims their own redeem (receives USDC)
     * @dev Standard ERC-7540: User calls with no parameters, uses msg.sender
     */
    function claimRedeem() external {
        _claimRedeem(msg.sender);
    }

    /**
     * @dev Internal function to process redeem claim
     * @dev Following Centrifuge pattern: Calculate assets at claim time based on current share price
     */
    function _claimRedeem(address user) internal {
        RedeemRequest storage request = pendingRedeems[user];
        require(request.shares > 0, "No pending redeem");
        require(!request.fulfilled, "Already fulfilled");

        uint256 shares = request.shares;
        
        // Calculate assets at CLAIM time (not request time) - Centrifuge pattern
        // This calculation happens BEFORE burning, so totalSupply is accurate
        uint256 assets = convertToAssets(shares);

        // Mark as fulfilled
        request.fulfilled = true;

        // Burn shares at claim time (Centrifuge pattern)
        _burn(user, shares);

        // Transfer USDC to user
        IERC20(asset()).safeTransfer(user, assets);

        emit RedeemClaimed(user, shares, assets);
    }

    /**
     * @notice Check if user has a pending redeem that can be claimed
     * @param user Address to check
     * @return shares Amount of shares pending, 0 if none
     */
    function pendingRedeemRequest(address user) external view returns (uint256 shares) {
        RedeemRequest memory request = pendingRedeems[user];
        return (!request.fulfilled && request.shares > 0) ? request.shares : 0;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // OPERATOR PATTERN: Auto-claim functions
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Operator can claim deposit on behalf of user (automation)
     * @param user The user whose deposit to claim
     */
    function claimDepositFor(address user) external onlyOperator {
        _claimDeposit(user);
    }

    /**
     * @notice Operator can claim redeem on behalf of user (automation)
     * @param user The user whose redeem to claim
     */
    function claimRedeemFor(address user) external onlyOperator {
        _claimRedeem(user);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // ERC-4626 OVERRIDES
    // ═════════════════════════════════════════════════════════════════════════════
    // Note: totalAssets(), convertToShares(), convertToAssets(), decimals() are inherited from ERC4626
    // We only override totalAssets() to use our custom implementation

    /**
     * @notice Total assets under management (USDC in vault)
     * @dev Overrides ERC4626 to use direct balance check
     *      The actual USDC balance reflects realized profits/losses from simulator
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update the operator address
     * @param newOperator New operator address
     */
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid operator");
        address oldOperator = operator;
        operator = newOperator;
        emit OperatorUpdated(oldOperator, newOperator);
    }


    /**
     * @notice Set the simulator address (market bot)
     * @param newSimulator New simulator address
     */
    function setSimulator(address newSimulator) external onlyOwner {
        require(newSimulator != address(0), "Invalid simulator");
        address oldSimulator = simulator;
        simulator = newSimulator;
        emit SimulatorUpdated(oldSimulator, newSimulator);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // PROFIT/LOSS REALIZATION (IProfitLossRealizer Implementation)
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Realize profit from simulated strategies
     * @param token Token address (must match vault asset - USDC)
     * @param amount Profit amount that was added
     * @dev Simulator must transfer USDC to vault BEFORE calling this.
     *      This function only emits an event for tracking - the actual balance
     *      increase from the transfer automatically increases share price!
     */
    function realizeProfit(address token, uint256 amount) external override onlySimulator {
        require(token == address(asset()), "Wrong token");
        require(amount > 0, "Zero amount");

        // Just emit event - the USDC transfer already happened and balance reflects it!
        emit ProfitRealized(token, amount, block.timestamp);
    }

    /**
     * @notice Realize loss from simulated strategies
     * @param token Token address (must match vault asset - USDC)
     * @param amount Loss amount to remove
     * @dev Transfers USDC from vault to simulator (simulating loss).
     *      The balance decrease automatically decreases share price!
     *      CRITICAL: Cannot touch reserved assets!
     */
    function realizeLoss(address token, uint256 amount) external override onlySimulator {
        require(token == address(asset()), "Wrong token");
        require(amount > 0, "Zero amount");
        require(amount <= totalAssets(), "Insufficient balance");

        // Transfer USDC to simulator (representing loss)
        IERC20(asset()).safeTransfer(simulator, amount);

        // Emit event for tracking
        emit LossRealized(token, amount, block.timestamp);
    }
}

