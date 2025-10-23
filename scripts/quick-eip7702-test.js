/**
 * Quick EIP-7702 Test
 * Just tries to send a type-4 transaction to see if Sepolia supports it
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function quickTest() {
    console.log('🧪 Quick EIP-7702 Test on Sepolia\n');
    console.log('='.repeat(70));
    
    const provider = new ethers.JsonRpcProvider(
        process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org'
    );
    const wallet = new ethers.Wallet(process.env.MAIN_PRIVATE_KEY || process.env.BOT_PRIVATE_KEY, provider);
    
    console.log('Testing with address:', wallet.address);
    console.log('');
    
    try {
        // Try to create a type-4 transaction
        console.log('Attempting to create EIP-7702 (type 4) transaction...');
        
        const authTx = {
            type: 4, // EIP-7702 transaction type
            chainId: 11155111,
            nonce: await wallet.getNonce(),
            maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
            maxFeePerGas: ethers.parseUnits('10', 'gwei'),
            gasLimit: 50000,
            to: wallet.address,
            value: 0,
            data: '0x',
            authorizationList: [{
                chainId: 11155111,
                address: '0x0000000000000000000000000000000000000000', // Dummy address
                nonce: 0,
            }]
        };
        
        console.log('Signing transaction...');
        const signedTx = await wallet.signTransaction(authTx);
        console.log('✅ Transaction signed successfully!');
        console.log('Signed tx length:', signedTx.length);
        
        // Try to broadcast (this is where it will fail if not supported)
        console.log('\nAttempting to broadcast...');
        const tx = await provider.broadcastTransaction(signedTx);
        
        console.log('\n🎉 SUCCESS! EIP-7702 IS SUPPORTED!');
        console.log('Transaction hash:', tx.hash);
        console.log('\nThis means:');
        console.log('✅ Sepolia supports type-4 transactions');
        console.log('✅ EIP-7702 is live!');
        console.log('✅ We can use it in our project!');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ EIP-7702 Test FAILED');
        console.error('Error:', error.message);
        
        if (error.message.includes('unknown transaction type') || 
            error.message.includes('type') ||
            error.message.includes('unsupported')) {
            console.log('\n📊 Analysis:');
            console.log('❌ Sepolia does NOT support type-4 transactions');
            console.log('❌ EIP-7702 is NOT yet available');
            console.log('');
            console.log('💡 Recommendation:');
            console.log('- Drop EIP-7702 from project');
            console.log('- Focus on ERC-7540 + PYUSD + Avail');
            console.log('- Still target $14.5K prizes');
        } else {
            console.log('\n⚠️  Unexpected error. Might be:');
            console.log('- Network connectivity issue');
            console.log('- RPC node issue');
            console.log('- Transaction format issue');
        }
        
        return false;
    }
}

quickTest()
    .then(success => {
        console.log('\n' + '='.repeat(70));
        console.log(success ? '✅ EIP-7702 AVAILABLE' : '❌ EIP-7702 NOT AVAILABLE');
        console.log('='.repeat(70));
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

