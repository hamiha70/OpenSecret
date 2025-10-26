// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AsyncVault.sol";

/**
 * @title DeployAsyncVault
 * @notice Deployment script for AsyncVault (configurable chain via .env)
 * @dev Usage: 
 *   Ethereum Sepolia: forge script script/DeployAsyncVault.s.sol:DeployAsyncVault --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast
 *   Arbitrum Sepolia: forge script script/DeployAsyncVault.s.sol:DeployAsyncVault --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
 */
contract DeployAsyncVault is Script {
    // USDC addresses (auto-detected by chain ID)
    address constant USDC_ETHEREUM_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    
    function run() external {
        // Load account configuration
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address simulator = vm.envAddress("SIMULATOR_ADDRESS");
        
        // Auto-detect chain and select correct USDC
        uint256 chainId = block.chainid;
        address usdcAddress;
        string memory chainName;
        
        if (chainId == 11155111) {
            usdcAddress = USDC_ETHEREUM_SEPOLIA;
            chainName = "Ethereum Sepolia";
        } else if (chainId == 421614) {
            usdcAddress = USDC_ARBITRUM_SEPOLIA;
            chainName = "Arbitrum Sepolia";
        } else {
            revert("Unsupported chain! Use Ethereum Sepolia (11155111) or Arbitrum Sepolia (421614)");
        }
        
        console.log("============================================");
        console.log("DEPLOYING ASYNCVAULT TO", chainName);
        console.log("============================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer (Owner):", deployer);
        console.log("Operator:", deployer, "(same as owner initially)");
        console.log("Simulator:", simulator);
        console.log("USDC:", usdcAddress);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy vault with separate accounts
        AsyncVault vault = new AsyncVault(
            usdcAddress,
            deployer,   // Operator (deployer can also operate, or change to bot later)
            simulator,  // Simulator (separate account for profit/loss)
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
        console.log("Owner:", vault.owner());
        console.log("Operator:", vault.operator());
        console.log("Simulator:", vault.simulator());
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

