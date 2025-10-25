#!/bin/bash
# Run forked tests against Sepolia testnet
# This script tests the vault against real Sepolia state

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     AsyncVault Sepolia Fork Tests                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Load environment variables from root .env
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "❌ .env file not found in root directory!"
    exit 1
fi

# Check required env vars
if [ -z "$ETHEREUM_SEPOLIA_RPC" ]; then
    echo "❌ ETHEREUM_SEPOLIA_RPC not set in .env"
    exit 1
fi

echo "📡 Using RPC: ${ETHEREUM_SEPOLIA_RPC:0:50}..."
echo "📍 Deployer: $DEPLOYER_ADDRESS"
echo "📍 Investor: $INVESTOR_ADDRESS"
echo "📍 Simulator: $SIMULATOR_ADDRESS"
echo ""

# Run forked tests from root directory
echo "🔄 Running forked tests..."
echo ""

cd contracts-foundry

# Foundry will read .env from contracts-foundry or parent directory
# But we'll also pass it explicitly for clarity
forge test \
    --match-contract AsyncVaultForkTest \
    -vv

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All forked tests passed!"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Review gas costs in the output"
    echo "   2. Check that operator pattern works correctly"
    echo "   3. Deploy to Sepolia: cd contracts-foundry && forge script script/DeployAsyncVault.s.sol --rpc-url \$ETHEREUM_SEPOLIA_RPC --broadcast"
else
    echo "❌ Some tests failed. Review the output above."
    echo ""
    echo "💡 Common issues:"
    echo "   - Insufficient USDC balance (check with Blockscout MCP)"
    echo "   - RPC rate limiting (wait a bit and retry)"
    echo "   - Network connectivity"
fi

exit $EXIT_CODE

