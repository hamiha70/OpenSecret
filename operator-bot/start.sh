#!/bin/bash
# Start the operator bot with clean output (suppressing ethers.js stderr warnings)

cd "$(dirname "$0")"

echo "🚀 Starting AsyncVault Operator Bot..."
echo "   (Suppressing ethers.js filter warnings)"
echo ""

# Run the bot and redirect stderr filter errors to /dev/null
# while preserving actual errors
node index.js 2> >(grep -v "filter not found" >&2)

