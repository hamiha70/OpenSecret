
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VaultX} from "./VaultX.sol";

/// @notice Minimal router called by Avail Nexus or a bridge message executor.
contract Router {
    VaultX public immutable vault;
    address public manager;

    modifier onlyManager { require(msg.sender == manager, "not manager"); _; }

    constructor(VaultX _vault, address _manager) {
        vault = _vault;
        manager = _manager;
    }

    function onBridgeArrived(bytes calldata payload) external onlyManager {
        // decode and mark requests claimable etc.
        (uint256 id) = abi.decode(payload, (uint256));
        vault.setClaimable(id);
    }
}
