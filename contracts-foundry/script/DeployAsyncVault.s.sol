// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AsyncVault.sol";

/**
 * @title DeployAsyncVault
 * @notice Deployment script for AsyncVault on Ethereum Sepolia
 * @dev Usage: forge script script/DeployAsyncVault.s.sol:DeployAsyncVault --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --verify -vvvv
 */
contract DeployAsyncVault is Script {
    // USDC on Ethereum Sepolia (Circle's official deployment)
    address constant USDC_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("MAIN_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("============================================");
        console.log("DEPLOYING ASYNCVAULT TO ETHEREUM SEPOLIA");
        console.log("============================================");
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC_SEPOLIA);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy vault with deployer as initial operator and simulator
        AsyncVault vault = new AsyncVault(
            USDC_SEPOLIA,
            deployer, // Operator (can be changed later)
            deployer, // Simulator (can be changed later to market bot address)
            "Async USDC",
            "asUSDC"
        );
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("============================================");
        console.log("DEPLOYMENT SUCCESSFUL");
        console.log("============================================");
        console.log("AsyncVault:", address(vault));
        console.log("Asset (USDC):", address(vault.asset()));
        console.log("Operator:", vault.operator());
        console.log("Simulator:", vault.simulator());
        console.log("Owner:", vault.owner());
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify contract on Etherscan/Blockscout");
        console.log("2. Update frontend with vault address");
        console.log("3. Create simulator wallet and fund with 50-100 USDC");
        console.log("4. Call setSimulator() to update simulator address");
        console.log("5. Deploy market bot to AWS");
        console.log("6. Test full flow: deposit -> profit -> redeem");
        console.log("============================================");
    }
}

