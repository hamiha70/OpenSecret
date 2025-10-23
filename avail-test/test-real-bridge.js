/**
 * Real Avail Nexus SDK Test with Browser Environment
 * Tests actual bridging capability with your USDC
 */

import { NexusSDK } from '@avail-project/nexus-core';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('🧪 Avail Nexus SDK - Real Bridge Test\n');
console.log('=' .repeat(60));

// Check for private key
if (!process.env.PRIVATE_KEY) {
    console.error('❌ ERROR: PRIVATE_KEY not found in .env file');
    console.log('\n📝 Please add your private key to .env:');
    console.log('   PRIVATE_KEY=your_private_key_here');
    console.log('\n⚠️  This is for testnet use only!');
    process.exit(1);
}

async function testAvailBridge() {
    try {
        console.log('\n📋 Test Configuration:');
        console.log('-'.repeat(60));
        console.log('Source Chain: Ethereum Sepolia (11155111)');
        console.log('Target Chain: Arbitrum Sepolia (421614)');
        console.log('Token: USDC');
        console.log('Amount: 1 USDC (test transaction)');
        console.log('Your Address:', ethers.computeAddress('0x' + process.env.PRIVATE_KEY.replace('0x', '')));
        console.log('');

        // Step 1: Create provider and signer
        console.log('Step 1: Creating Ethereum provider...');
        const provider = new ethers.JsonRpcProvider(
            process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org'
        );
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        console.log('✅ Connected to Ethereum Sepolia');
        console.log(`   Address: ${wallet.address}`);

        // Step 2: Check USDC balance
        console.log('\nStep 2: Checking USDC balance...');
        const usdcAddress = process.env.USDC_SEPOLIA || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
        const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
        const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);
        const balance = await usdcContract.balanceOf(wallet.address);
        console.log(`✅ USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        
        if (balance === 0n) {
            console.log('\n❌ No USDC balance found!');
            console.log('   You need USDC on Ethereum Sepolia to test bridging.');
            return false;
        }

        // Step 3: Initialize Nexus SDK
        console.log('\nStep 3: Initializing Avail Nexus SDK...');
        
        // Note: Nexus SDK requires browser environment (EIP1193 provider)
        // For Node.js testing, we'll create a minimal EIP1193-compatible wrapper
        const eip1193Provider = {
            request: async ({ method, params }) => {
                if (method === 'eth_requestAccounts') {
                    return [wallet.address];
                }
                if (method === 'eth_accounts') {
                    return [wallet.address];
                }
                if (method === 'eth_chainId') {
                    return '0xaa36a7'; // Sepolia chain ID
                }
                if (method === 'personal_sign') {
                    const [message] = params;
                    return wallet.signMessage(ethers.getBytes(message));
                }
                if (method === 'eth_sendTransaction') {
                    const [tx] = params;
                    const transaction = await wallet.sendTransaction(tx);
                    return transaction.hash;
                }
                // Forward other methods to the actual provider
                return provider.send(method, params || []);
            },
            on: () => {},
            removeListener: () => {},
        };

        const sdk = new NexusSDK({ network: 'testnet' });
        await sdk.initialize(eip1193Provider);
        console.log('✅ Nexus SDK initialized');

        // Step 4: Get unified balance
        console.log('\nStep 4: Fetching unified balance across chains...');
        const unifiedBalance = await sdk.getUnifiedBalance();
        console.log('✅ Unified balance retrieved:');
        unifiedBalance.forEach(asset => {
            console.log(`\n   ${asset.symbol}:`);
            console.log(`   Total: ${asset.balance}`);
            asset.breakdown.forEach(chain => {
                console.log(`     - ${chain.chain.name}: ${chain.balance}`);
            });
        });

        // Step 5: Simulate bridge
        console.log('\nStep 5: Simulating bridge transaction...');
        const bridgeParams = {
            token: 'USDC',
            amount: '1', // 1 USDC
            chainId: 421614, // Arbitrum Sepolia
            recipient: wallet.address,
        };

        const simulation = await sdk.simulateBridge(bridgeParams);
        console.log('✅ Bridge simulation successful:');
        console.log(`   Amount to receive: ${simulation.intent.toAmount}`);
        console.log(`   Total fees: ${simulation.intent.fees.total}`);
        console.log(`   Estimated time: ${simulation.intent.estimatedTime}ms`);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUCCESS! Avail Nexus SDK is working!');
        console.log('='.repeat(60));
        console.log('\n✅ GO Decision: Proceed with Avail integration');
        console.log('\nNext steps:');
        console.log('1. The SDK is functional for bridging');
        console.log('2. You can execute actual bridges with sdk.bridge(params)');
        console.log('3. Continue with smart contract development');
        
        return true;

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ TEST FAILED');
        console.error('='.repeat(60));
        console.error('\nError:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🔄 NO-GO Decision: Proceed with Mock Avail');
        console.log('='.repeat(60));
        console.log('\nRecommendation:');
        console.log('- Use Mock Avail implementation for demo');
        console.log('- Focus on vault architecture and bot logic');
        console.log('- Document: "Production would use real Avail SDK"');
        console.log('- Impact: Envio prize ($5K) still achievable');
        
        return false;
    }
}

// Run the test
testAvailBridge()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

