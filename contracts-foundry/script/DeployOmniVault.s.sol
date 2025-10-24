// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/OmniVault.sol";

/**
 * @title DeployOmniVault
 * @notice Deployment script for OmniVault on Ethereum Sepolia
 * @dev Usage: forge script script/DeployOmniVault.s.sol:DeployOmniVault --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --verify -vvvv
 */
contract DeployOmniVault is Script {
    // USDC on Ethereum Sepolia (Circle's official deployment)
    address constant USDC_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAIN_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("============================================");
        console.log("DEPLOYING OMNIVAULT TO ETHEREUM SEPOLIA");
        console.log("============================================");
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC_SEPOLIA);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy vault with deployer as initial operator
        OmniVault vault = new OmniVault(
            USDC_SEPOLIA,
            deployer, // Operator (can be changed later)
            "OmniVault USDC",
            "ovUSDC"
        );
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("============================================");
        console.log("DEPLOYMENT SUCCESSFUL");
        console.log("============================================");
        console.log("OmniVault:", address(vault));
        console.log("Asset (USDC):", address(vault.asset()));
        console.log("Operator:", vault.operator());
        console.log("Owner:", vault.owner());
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify contract on Etherscan");
        console.log("2. Update frontend with vault address");
        console.log("3. Test deposit flow via frontend");
        console.log("============================================");
    }
}

