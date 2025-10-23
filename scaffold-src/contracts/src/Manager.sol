
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VaultX} from "./VaultX.sol";

/// @notice Role-gated manager (EIP-7702-friendly) that marks requests claimable and can trigger rebalance hooks.
contract Manager {
    address public owner;
    VaultX public immutable vault;

    event OwnershipTransferred(address indexed from, address indexed to);

    modifier onlyOwner { require(msg.sender == owner, "not owner"); _; }

    constructor(VaultX _vault, address _owner) {
        vault = _vault;
        owner = _owner;
    }

    function transferOwnership(address to) external onlyOwner {
        owner = to; emit OwnershipTransferred(msg.sender, to);
    }

    function acceptDeposit(uint256 requestId) external onlyOwner {
        vault.setClaimable(requestId);
    }

    function fulfillRedeem(uint256 requestId) external onlyOwner {
        vault.setClaimable(requestId);
    }

    // stub: cross-chain rebalance plan
    function rebalance(bytes calldata /*plan*/) external onlyOwner { }
}
