// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Simple EIP-7702 Test Contract
 * @notice This contract will be delegated to by an EOA via EIP-7702
 * @dev First test: Can we make an EOA execute smart contract code?
 */
contract SimpleVaultLogic {
    // Storage layout (will be in user's EOA!)
    mapping(address => uint256) public balances;
    
    event Deposited(address user, uint256 amount);
    event Message(string message);
    
    /**
     * @notice Simple deposit function to test EIP-7702
     * @dev This will execute in the context of the user's EOA
     */
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
        emit Message("EIP-7702 works! EOA is executing contract code!");
    }
    
    /**
     * @notice Get balance
     * @dev Reading from EOA's storage
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @notice Test function to verify delegation worked
     */
    function isContractCode() external pure returns (bool) {
        return true; // If this returns true from an EOA, EIP-7702 works!
    }
}

