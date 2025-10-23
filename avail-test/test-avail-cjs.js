/**
 * Avail Nexus SDK Test - CommonJS version
 */

async function testAvailSDK() {
    console.log('🧪 Testing Avail Nexus SDK (CommonJS)...\n');
    
    try {
        // Test 1: Can we require the SDK?
        console.log('Test 1: Requiring SDK...');
        const NexusSDK = require('@avail-project/nexus');
        console.log('✅ SDK required successfully');
        console.log('Exported:', Object.keys(NexusSDK));
        
        // Test 2: Can we create an instance?
        console.log('\nTest 2: Creating SDK instance...');
        const sdk = new NexusSDK.default({ network: 'testnet' });
        console.log('✅ SDK instance created');
        
        // Test 3: Check available methods
        console.log('\nTest 3: Checking available methods...');
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sdk));
        console.log('Available methods:', methods);
        
        console.log('\n🎉 RESULT: GO - Avail SDK is functional!');
        console.log('✅ Proceed with Avail integration\n');
        return true;
        
    } catch (error) {
        console.error('\n❌ RESULT: NO-GO - Avail SDK failed');
        console.error('Error:', error.message);
        console.error('\nStack:', error.stack);
        console.log('\n🔄 Decision: Use Mock Avail implementation');
        return false;
    }
}

// Run test
testAvailSDK()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });

