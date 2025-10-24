// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IProfitLossRealizer} from "./interfaces/IProfitLossRealizer.sol";

/**
 * @title AsyncVault
 * @notice ERC-7540 Asynchronous Vault with Operator Pattern + Profit/Loss Simulation
 * @dev Implements asynchronous deposit/redeem requests with operator auto-claiming
 *      AND IProfitLossRealizer for simulated strategy performance
 * 
 * Architecture:
 * - Users call requestDeposit/requestRedeem (ERC-7540 async pattern)
 * - Operator (or frontend) calls claimDeposit/claimRedeem to fulfill requests
 * - Market bot calls realizeProfit/realizeLoss to simulate strategy performance
 * - Integrates with Avail Nexus for cross-chain user onboarding
 * - Single-chain vault on Ethereum Sepolia holding USDC
 * 
 * UX Flow:
 * 1. User bridges USDC via Avail Nexus (from any chain to Sepolia)
 * 2. User calls requestDeposit (1 tx)
 * 3. Frontend polls & operator auto-claims (0 additional user txs)
 * 4. Market bot simulates profit/loss → share price changes
 * 5. User receives shares with dynamic pricing based on performance
 */
contract AsyncVault is ERC20, Ownable, IProfitLossRealizer {
    using SafeERC20 for IERC20;

    // ═════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice The underlying asset (USDC)
    IERC20 public immutable asset;

    /// @notice Decimals of the underlying asset
    uint8 private immutable _assetDecimals;

    /// @notice Trusted operator who can fulfill requests on behalf of users
    address public operator;

    /// @notice Mock strategy contract (for demo purposes)
    address public strategy;

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
        uint256 assets;        // Amount of assets to receive (snapshotted at request time)
        uint256 timestamp;     // When request was made
        bool fulfilled;        // Whether operator has processed it
    }

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
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event StrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    event SimulatorUpdated(address indexed oldSimulator, address indexed newSimulator);

    // ═════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @param _asset The underlying asset (USDC address on Sepolia)
     * @param _operator The trusted operator address
     * @param _simulator The market simulation bot address
     * @param _name ERC20 token name (e.g., "OmniVault USDC")
     * @param _symbol ERC20 token symbol (e.g., "ovUSDC")
     */
    constructor(
        address _asset,
        address _operator,
        address _simulator,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_asset != address(0), "Invalid asset");
        require(_operator != address(0), "Invalid operator");
        require(_simulator != address(0), "Invalid simulator");

        asset = IERC20(_asset);
        _assetDecimals = ERC20(_asset).decimals();
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
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Record the pending request
        pendingDeposits[msg.sender] = DepositRequest({
            assets: assets,
            timestamp: block.timestamp,
            fulfilled: false
        });

        emit DepositRequested(msg.sender, assets, block.timestamp);
    }

    /**
     * @notice Operator fulfills a deposit request and mints shares
     * @param user The user whose request to fulfill
     * @dev Can be called by operator or user themselves (for self-service)
     */
    function claimDeposit(address user) external {
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

        // Calculate assets BEFORE burning shares (to get correct share price)
        uint256 assets = convertToAssets(shares);

        // Burn shares immediately (lock them)
        _burn(msg.sender, shares);

        // Record the pending request with snapshotted asset value
        pendingRedeems[msg.sender] = RedeemRequest({
            shares: shares,
            assets: assets,
            timestamp: block.timestamp,
            fulfilled: false
        });

        emit RedeemRequested(msg.sender, shares, block.timestamp);
    }

    /**
     * @notice Operator fulfills a redeem request and returns USDC
     * @param user The user whose request to fulfill
     */
    function claimRedeem(address user) external {
        RedeemRequest storage request = pendingRedeems[user];
        require(request.shares > 0, "No pending redeem");
        require(!request.fulfilled, "Already fulfilled");

        // Use the snapshotted assets value from request time
        uint256 assets = request.assets;

        // Mark as fulfilled
        request.fulfilled = true;

        // Transfer USDC to user
        asset.safeTransfer(user, assets);

        emit RedeemClaimed(user, request.shares, assets);
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
    // ERC-4626 COMPATIBILITY (VIEW FUNCTIONS) - Modified for Virtual P&L
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Total assets under management (USDC in vault + strategy)
     * @dev The actual USDC balance already reflects realized profits/losses
     *      because the simulator transfers actual tokens. We don't need to add
     *      virtualProfitLoss here since it's already in the balance.
     */
    function totalAssets() public view returns (uint256) {
        uint256 vaultBalance = asset.balanceOf(address(this));
        uint256 strategyBalance = strategy != address(0) ? asset.balanceOf(strategy) : 0;
        return vaultBalance + strategyBalance;
    }

    /**
     * @notice Convert assets to shares (1:1 for MVP, upgradeable to dynamic pricing)
     */
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return assets; // Bootstrap: 1:1
        }
        return (assets * supply) / totalAssets();
    }

    /**
     * @notice Convert shares to assets
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return shares; // Bootstrap: 1:1
        }
        return (shares * totalAssets()) / supply;
    }

    /**
     * @notice Get the decimals of the vault shares (matches asset decimals)
     */
    function decimals() public view virtual override returns (uint8) {
        return _assetDecimals;
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
     * @notice Set the strategy contract (for future yield generation)
     * @param newStrategy Strategy contract address
     */
    function setStrategy(address newStrategy) external onlyOwner {
        address oldStrategy = strategy;
        strategy = newStrategy;
        emit StrategyUpdated(oldStrategy, newStrategy);
    }

    /**
     * @notice Deposit USDC into strategy (for future yield farming)
     * @param amount Amount to deposit into strategy
     */
    function depositToStrategy(uint256 amount) external onlyOperator {
        require(strategy != address(0), "No strategy set");
        require(amount <= asset.balanceOf(address(this)), "Insufficient balance");
        asset.safeTransfer(strategy, amount);
    }

    /**
     * @notice Withdraw USDC from strategy back to vault
     * @param amount Amount to withdraw from strategy
     */
    function withdrawFromStrategy(uint256 amount) external onlyOperator {
        require(strategy != address(0), "No strategy set");
        // In a real implementation, this would call strategy.withdraw()
        // For demo, we assume strategy can transfer back
        asset.safeTransferFrom(strategy, address(this), amount);
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
        require(token == address(asset), "Wrong token");
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
     */
    function realizeLoss(address token, uint256 amount) external override onlySimulator {
        require(token == address(asset), "Wrong token");
        require(amount > 0, "Zero amount");
        require(asset.balanceOf(address(this)) >= amount, "Insufficient balance");

        // Transfer USDC to simulator (representing loss)
        asset.safeTransfer(simulator, amount);

        // Emit event for tracking
        emit LossRealized(token, amount, block.timestamp);
    }
}

