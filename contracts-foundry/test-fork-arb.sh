#!/bin/bash

# Quick fork test on Arbitrum Sepolia
# Usage: ./test-fork-arb.sh

set -e

echo "🔧 Checking .env..."
if [ ! -f .env ] && [ ! -f ../.env ]; then
    echo "❌ ERROR: .env not found"
    exit 1
fi

# Copy .env from parent if not in current dir (avoid self-copy)
if [ ! -f .env ] && [ -f ../.env ]; then
    cp ../.env .
    echo "✅ .env copied from parent"
elif [ -f .env ]; then
    echo "✅ .env already present"
fi
echo ""
echo "🚀 Running fork tests on Arbitrum Sepolia..."
echo ""

# Load environment variables
source .env

# Verify RPC URL exists
if [ -z "$ARBITRUM_SEPOLIA_RPC" ]; then
    echo "❌ ERROR: ARBITRUM_SEPOLIA_RPC not set in .env"
    exit 1
fi

echo "Using RPC: ${ARBITRUM_SEPOLIA_RPC:0:50}..."
echo ""

# Run fork tests with Arbitrum Sepolia RPC
forge test \
    --match-contract AsyncVaultForkTest \
    --fork-url "$ARBITRUM_SEPOLIA_RPC" \
    -vv

echo ""
echo "✅ Fork tests complete!"
