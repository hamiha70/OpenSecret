
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Simplified interface for demo purposes
interface IERC7540 {
    event DepositRequested(address indexed owner, uint256 indexed id, uint256 assets, address receiver);
    event DepositClaimed(address indexed receiver, uint256 indexed id, uint256 shares);
    event RedeemRequested(address indexed owner, uint256 indexed id, uint256 shares, address receiver);
    event RedeemClaimed(address indexed receiver, uint256 indexed id, uint256 assets);

    function requestDeposit(uint256 assets, address receiver) external returns (uint256 id);
    function claimDeposit(uint256 id, address receiver) external returns (uint256 shares);

    function requestRedeem(uint256 shares, address receiver) external returns (uint256 id);
    function claimRedeem(uint256 id, address receiver) external returns (uint256 assets);

    function requestStatus(uint256 id) external view returns (uint8); // 0=pending,1=claimable,2=claimed,3=cancelled
}
