
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @notice Minimal demo-only ERC-4626-like interface
abstract contract MinimalERC4626 {
    IERC20 public immutable asset;
    uint8 public immutable decimals;

    constructor(IERC20 _asset, uint8 _decimals) {
        asset = _asset;
        decimals = _decimals;
    }

    function totalAssets() public view virtual returns (uint256);
    function convertToShares(uint256 assets) public view virtual returns (uint256);
    function convertToAssets(uint256 shares) public view virtual returns (uint256);
}
