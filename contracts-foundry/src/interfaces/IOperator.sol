// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOperator
 * @notice Interface for operator pattern in ERC-7540 vaults
 * @dev Operators can claim deposits/redeems on behalf of users for better UX
 */
interface IOperator {
    /**
     * @notice Emitted when the operator address is updated
     * @param oldOperator The previous operator address
     * @param newOperator The new operator address
     */
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    /**
     * @notice Returns the current operator address
     * @return The address authorized to claim on behalf of users
     */
    function operator() external view returns (address);

    /**
     * @notice Updates the operator address (only callable by owner)
     * @param newOperator The new operator address
     */
    function setOperator(address newOperator) external;

    /**
     * @notice Operator claims pending deposit on behalf of a user
     * @param user The user whose deposit to claim
     */
    function claimDepositFor(address user) external;

    /**
     * @notice Operator claims pending redeem on behalf of a user
     * @param user The user whose redeem to claim
     */
    function claimRedeemFor(address user) external;
}

