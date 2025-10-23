/**
 * Test EIP-7702 on Sepolia
 * 
 * This script:
 * 1. Deploys SimpleVaultLogic contract
 * 2. User signs EIP-7702 AUTH transaction
 * 3. User's EOA now executes the contract code
 * 4. Verifies it works by calling deposit()
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function testEIP7702() {
    console.log('🧪 Testing EIP-7702 on Sepolia\n');
    console.log('='.repeat(70));
    
    // Setup
    const provider = new ethers.JsonRpcProvider(
        process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org'
    );
    const wallet = new ethers.Wallet(process.env.MAIN_PRIVATE_KEY || process.env.BOT_PRIVATE_KEY, provider);
    
    console.log('Wallet Address:', wallet.address);
    console.log('');
    
    // Step 1: Check if address currently has code
    console.log('Step 1: Checking current address state...');
    const codeBefore = await provider.getCode(wallet.address);
    console.log('Code before delegation:', codeBefore === '0x' ? 'EOA (no code) ✅' : 'Has code');
    
    if (codeBefore !== '0x') {
        console.log('⚠️  Address already has code. This might be from previous EIP-7702 delegation.');
    }
    
    // Step 2: Deploy the implementation contract (or use existing)
    console.log('\nStep 2: Deploying SimpleVaultLogic...');
    
    const implementationCode = `
        // Compiled bytecode would go here
        // For testing, we'll use a pre-deployed address
    `;
    
    // TODO: Replace with actual deployed contract address after deployment
    const IMPLEMENTATION_ADDRESS = '0x...'; // Deploy first, then add here
    
    console.log('Implementation deployed at:', IMPLEMENTATION_ADDRESS);
    
    // Step 3: Create EIP-7702 AUTH transaction
    console.log('\nStep 3: Creating EIP-7702 AUTH transaction...');
    
    try {
        // EIP-7702 transaction format
        const authTx = {
            type: 4, // EIP-7702 transaction type
            chainId: 11155111, // Sepolia
            nonce: await wallet.getNonce(),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
            maxFeePerGas: ethers.parseUnits('20', 'gwei'),
            gasLimit: 100000,
            to: wallet.address, // Delegate to self (strange but correct!)
            value: 0,
            data: '0x', // No data needed
            authorizationList: [
                {
                    chainId: 11155111,
                    address: IMPLEMENTATION_ADDRESS, // The contract code to delegate to
                    nonce: 0, // Authorization nonce
                    v: 0, // Will be filled by signature
                    r: '0x',
                    s: '0x',
                }
            ]
        };
        
        console.log('Signing AUTH transaction...');
        const signedTx = await wallet.signTransaction(authTx);
        
        console.log('Sending transaction...');
        const tx = await provider.broadcastTransaction(signedTx);
        
        console.log('Transaction hash:', tx.hash);
        console.log('Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed!');
        
        // Step 4: Verify EOA now has code
        console.log('\nStep 4: Verifying delegation...');
        const codeAfter = await provider.getCode(wallet.address);
        console.log('Code after delegation:', codeAfter === '0x' ? 'Still EOA ❌' : 'Has code! ✅');
        
        if (codeAfter !== '0x') {
            console.log('\n🎉 SUCCESS! EIP-7702 WORKS!');
            console.log('Your EOA now executes contract code!');
            
            // Step 5: Test calling a contract function from the EOA
            console.log('\nStep 5: Testing contract function call...');
            
            const vaultInterface = new ethers.Interface([
                'function deposit() external payable',
                'function getBalance(address) external view returns (uint256)',
                'function isContractCode() external pure returns (bool)'
            ]);
            
            const delegatedVault = new ethers.Contract(wallet.address, vaultInterface, wallet);
            
            // Call isContractCode() - should return true!
            const isContract = await delegatedVault.isContractCode();
            console.log('isContractCode():', isContract ? 'true ✅' : 'false ❌');
            
            if (isContract) {
                console.log('\n🚀 FULL SUCCESS! EOA is executing contract logic!');
                console.log('\nThis means we can:');
                console.log('✅ Build EIP-7702 powered vault');
                console.log('✅ EOA interacts with Avail (wallet behavior)');
                console.log('✅ EOA executes vault logic (contract behavior)');
                console.log('✅ Single address for users (great UX)');
                console.log('\n🏆 This is a WINNING innovation!');
            }
        } else {
            console.log('\n❌ EIP-7702 delegation did not work');
            console.log('Possible reasons:');
            console.log('- EIP-7702 might not be fully enabled on Sepolia yet');
            console.log('- Transaction format might be incorrect');
            console.log('- Need to check Sepolia fork status');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (error.message.includes('unknown transaction type')) {
            console.log('\n⚠️  EIP-7702 (transaction type 4) is NOT supported on this network yet');
            console.log('Pectra might not be fully deployed on Sepolia');
        } else if (error.message.includes('AUTH')) {
            console.log('\n⚠️  Authorization list format issue');
        }
        
        console.log('\n📋 FALLBACK PLAN:');
        console.log('Build multi-chain vault without EIP-7702');
        console.log('Target: Envio ($5K) + Hardhat ($5K) = $10K');
    }
}

// Run test
testEIP7702()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

