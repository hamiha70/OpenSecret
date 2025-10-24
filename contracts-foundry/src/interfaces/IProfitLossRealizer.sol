// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProfitLossRealizer
 * @notice Interface for contracts that can simulate profit and loss
 * @dev Used by market simulation bots to adjust vault performance
 * @author OpenSecret Team
 */
interface IProfitLossRealizer {
    
    // ═════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═════════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Emitted when profit is realized from simulated strategies
     * @param token The token address (USDC in our case)
     * @param amount The profit amount
     * @param timestamp Block timestamp
     */
    event ProfitRealized(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when loss is realized from simulated strategies
     * @param token The token address (USDC in our case)
     * @param amount The loss amount
     * @param timestamp Block timestamp
     */
    event LossRealized(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    // ═════════════════════════════════════════════════════════════════════════════
    // FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Realize profit from strategies
     * @param token Token address (must match vault asset)
     * @param amount Profit amount that was added
     * @dev Caller (simulator) must transfer tokens to vault BEFORE calling this.
     *      This function emits an event for tracking. The actual USDC transfer
     *      automatically increases the vault balance and share price.
     */
    function realizeProfit(address token, uint256 amount) external;
    
    /**
     * @notice Realize loss from strategies
     * @param token Token address (must match vault asset)
     * @param amount Loss amount to remove
     * @dev This function transfers tokens from vault to simulator (representing loss).
     *      The balance decrease automatically affects share price.
     */
    function realizeLoss(address token, uint256 amount) external;
    
    /**
     * @notice Get the authorized simulator address
     * @return Address of the market simulation bot
     */
    function simulator() external view returns (address);
}

