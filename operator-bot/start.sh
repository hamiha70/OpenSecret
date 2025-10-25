#!/bin/bash
# Start the operator bot with clean output (suppressing ethers.js stderr warnings)

cd "$(dirname "$0")"

echo "🚀 Starting AsyncVault Operator Bot..."
echo "   (Suppressing ethers.js internal errors)"
echo ""

# Run the bot and filter out ethers.js internal errors
# Suppresses: filter not found, makeError, getRpcError, processTicksAndRejections, UNKNOWN_ERROR, eth_getFilterChanges
node index.js 2> >(grep -v -E "(filter not found|makeError|getRpcError|processTicksAndRejections|UNKNOWN_ERROR|eth_getFilterChanges|code: -32000)" >&2)

