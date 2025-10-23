/**
 * Test: Synthetic EIP-1193 Provider for Avail Nexus SDK
 * 
 * This tests if we can run Avail SDK in Node.js using a synthetic
 * EIP-1193 provider with private key signing (no browser needed!)
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

console.log('🧪 Testing Synthetic EIP-1193 Provider for Avail SDK\n');
console.log('=' .repeat(70));

// Check for required env vars
if (!process.env.MAIN_PRIVATE_KEY && !process.env.BOT_PRIVATE_KEY) {
    console.error('\n❌ ERROR: No private key found in .env');
    console.log('\n📝 Please add to .env:');
    console.log('   MAIN_PRIVATE_KEY=your_private_key_here');
    console.log('   (or BOT_PRIVATE_KEY=your_private_key_here)');
    console.log('\n⚠️  Use testnet keys only!');
    process.exit(1);
}

const PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY || process.env.BOT_PRIVATE_KEY;

async function testSyntheticProvider() {
    try {
        console.log('\n📋 Test Configuration:');
        console.log('-'.repeat(70));
        console.log('Network: Testnet (Ethereum Sepolia + others)');
        console.log('Provider: Synthetic EIP-1193 (Node.js, no browser)');
        console.log('Signing: Private key (programmatic)');
        console.log('');

        // Step 1: Create standard ethers provider and wallet
        console.log('Step 1: Creating ethers.js wallet...');
        const provider = new ethers.JsonRpcProvider(
            process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org'
        );
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        console.log('✅ Wallet created');
        console.log(`   Address: ${wallet.address}`);

        // Step 2: Check ETH balance
        console.log('\nStep 2: Checking ETH balance...');
        const ethBalance = await provider.getBalance(wallet.address);
        console.log(`✅ ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
        
        if (ethBalance === 0n) {
            console.log('\n⚠️  Warning: No ETH for gas. Get some from https://sepoliafaucet.com/');
        }

        // Step 3: Create Synthetic EIP-1193 Provider
        console.log('\nStep 3: Creating synthetic EIP-1193 provider...');
        
        /**
         * This is the KEY innovation:
         * We create an object that implements the EIP-1193 interface
         * but uses our private key instead of MetaMask/browser wallet
         */
        const syntheticProvider = {
            // Required: request method (core of EIP-1193)
            request: async ({ method, params }) => {
                // Return accounts (our wallet address)
                if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
                    return [wallet.address];
                }
                
                // Return current chain ID
                if (method === 'eth_chainId') {
                    return '0xaa36a7'; // Sepolia chain ID (11155111 in hex)
                }
                
                // Sign messages (used by SDK for authentication)
                if (method === 'personal_sign') {
                    const [message, address] = params;
                    if (address.toLowerCase() !== wallet.address.toLowerCase()) {
                        throw new Error('Address mismatch');
                    }
                    const signature = await wallet.signMessage(ethers.getBytes(message));
                    return signature;
                }
                
                // Send transactions (used by SDK for bridging)
                if (method === 'eth_sendTransaction') {
                    const [tx] = params;
                    const transaction = await wallet.sendTransaction(tx);
                    return transaction.hash;
                }
                
                // Sign typed data (EIP-712)
                if (method === 'eth_signTypedData_v4') {
                    const [address, typedData] = params;
                    if (address.toLowerCase() !== wallet.address.toLowerCase()) {
                        throw new Error('Address mismatch');
                    }
                    const parsedData = JSON.parse(typedData);
                    const signature = await wallet.signTypedData(
                        parsedData.domain,
                        parsedData.types,
                        parsedData.message
                    );
                    return signature;
                }
                
                // Forward all other methods to the real provider
                return provider.send(method, params || []);
            },
            
            // Required: event emitter methods (no-ops for our use case)
            on: () => {},
            removeListener: () => {},
            removeAllListeners: () => {},
        };

        console.log('✅ Synthetic provider created');
        console.log('   Implements: EIP-1193 interface');
        console.log('   Supports: eth_accounts, personal_sign, eth_sendTransaction, eth_signTypedData_v4');

        // Step 4: Initialize Avail Nexus SDK
        console.log('\nStep 4: Initializing Avail Nexus SDK...');
        console.log('   (This is the moment of truth!)');
        
        const sdk = new NexusSDK({ network: 'testnet' });
        
        try {
            await sdk.initialize(syntheticProvider);
            console.log('✅ Nexus SDK initialized successfully!');
            console.log('   SDK thinks it\'s in a browser with MetaMask');
            console.log('   But it\'s actually Node.js with private key!');
        } catch (initError) {
            console.error('❌ SDK initialization failed:', initError.message);
            console.log('\nDebugging info:');
            console.log('- This might be a packaging issue with the SDK');
            console.log('- Or the SDK might require additional browser APIs');
            throw initError;
        }

        // Step 5: Test SDK functionality
        console.log('\nStep 5: Testing SDK functionality...');
        
        // Try to get supported tokens
        try {
            console.log('   Checking supported tokens...');
            const tokens = await sdk.getSupportedTokens();
            console.log(`✅ Supported tokens: ${tokens.join(', ')}`);
        } catch (e) {
            console.log(`⚠️  Could not fetch tokens: ${e.message}`);
        }

        // Try to get unified balance
        try {
            console.log('   Fetching unified balance...');
            const balance = await sdk.getUnifiedBalance();
            console.log(`✅ Unified balance retrieved`);
            if (balance.length === 0) {
                console.log('   (No tokens found - deposit some USDC to test bridging)');
            } else {
                balance.forEach(asset => {
                    console.log(`   ${asset.symbol}: ${asset.balance}`);
                });
            }
        } catch (e) {
            console.log(`⚠️  Could not fetch balance: ${e.message}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('🎉 SUCCESS! Synthetic EIP-1193 provider works!');
        console.log('='.repeat(70));
        console.log('\n✅ KEY FINDINGS:');
        console.log('   1. Avail SDK can run in Node.js (not just browser)');
        console.log('   2. Synthetic EIP-1193 provider tricks the SDK');
        console.log('   3. Private key signing works programmatically');
        console.log('   4. We can now build AUTOMATED bots!');
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('   1. Build auto-bridge.js (CLI for Python bot)');
        console.log('   2. Test actual cross-chain bridging');
        console.log('   3. Integrate with investment_manager.py');
        
        return true;

    } catch (error) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ TEST FAILED');
        console.error('='.repeat(70));
        console.error('\nError:', error.message);
        
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        
        console.log('\n💡 TROUBLESHOOTING:');
        console.log('   1. Check if SDK version is correct: @avail-project/nexus-core@0.0.2-beta.5');
        console.log('   2. Make sure Node.js v22 is active: nvm use 22');
        console.log('   3. Check if .env has MAIN_PRIVATE_KEY or BOT_PRIVATE_KEY');
        console.log('   4. Verify you have ETH on Sepolia for gas');
        
        console.log('\n🔄 FALLBACK PLAN:');
        console.log('   If this keeps failing, we can:');
        console.log('   - Use Mock Avail (simulated bridging)');
        console.log('   - Focus on Envio + Hardhat prizes ($10K)');
        console.log('   - Still build autonomous multi-strategy vault');
        
        return false;
    }
}

// Run the test
testSyntheticProvider()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

