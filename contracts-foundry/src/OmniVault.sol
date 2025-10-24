// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OmniVault
 * @notice ERC-7540 Async Vault with Operator Pattern for Cross-Chain UX
 * @dev Implements asynchronous deposit/redeem requests with operator auto-claiming
 * 
 * Architecture:
 * - Users call requestDeposit/requestRedeem (async pattern)
 * - Operator (or frontend) calls claimDeposit/claimRedeem to fulfill requests
 * - Integrates with Avail Nexus for cross-chain user onboarding
 * - Single-chain vault on Ethereum Sepolia holding USDC
 * 
 * UX Flow:
 * 1. User bridges USDC via Avail Nexus (from any chain to Sepolia)
 * 2. User calls requestDeposit (1 tx)
 * 3. Frontend polls & operator auto-claims (0 additional user txs)
 * 4. User receives shares instantly from their perspective
 */
contract OmniVault is ERC20, Ownable {
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

    // ═════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @param _asset The underlying asset (USDC address on Sepolia)
     * @param _operator The trusted operator address
     * @param _name ERC20 token name (e.g., "OmniVault USDC")
     * @param _symbol ERC20 token symbol (e.g., "ovUSDC")
     */
    constructor(
        address _asset,
        address _operator,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_asset != address(0), "Invalid asset");
        require(_operator != address(0), "Invalid operator");

        asset = IERC20(_asset);
        _assetDecimals = ERC20(_asset).decimals();
        operator = _operator;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═════════════════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
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

        // Burn shares immediately (lock them)
        _burn(msg.sender, shares);

        // Record the pending request
        pendingRedeems[msg.sender] = RedeemRequest({
            shares: shares,
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

        // Calculate assets to return
        uint256 assets = convertToAssets(request.shares);

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
    // ERC-4626 COMPATIBILITY (VIEW FUNCTIONS)
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Total assets under management (USDC in vault + strategy)
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
}

