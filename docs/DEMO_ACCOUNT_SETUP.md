# Demo Account Setup for Avail Bridge Testing

## Key Insight: Avail Nexus Works Best With
- ✅ **Ethereum Sepolia** (destination chain - where vault is deployed)
- ✅ **Base Sepolia** (source chain - most stable for bridging)
- ⚠️ Arbitrum Sepolia (less stable, not recommended)
- ⚠️ Optimism Sepolia (less stable, not recommended)

## Account Addresses

### 1. Deployer/Investor (Main Account)
- **Address**: `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba`
- **Role**: Contract deployer, vault operator, end-user investor
- **Has USDC on**: Ethereum Sepolia ✅
- **Purpose**: Normal vault operations without bridging

### 2. Simulator (Market Bot)
- **Address**: `0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103`
- **Role**: Market simulation bot
- **Has USDC on**: Ethereum Sepolia ✅
- **Purpose**: Calls `realizeProfit()` and `realizeLoss()` on vault

### 3. Demo/Tester (Avail Bridge Demo)
- **Address**: `0xd6B9214bb9e34C626144BdE31ca9e61DD4B2Af9E`
- **Role**: Cross-chain bridge demonstration
- **Has USDC on**: **Base Sepolia** (to be funded)
- **Has USDC on Sepolia**: ❌ NO (intentionally - to demonstrate bridge)
- **Purpose**: Demonstrate automatic Avail Nexus bridging from Base → Sepolia

## Demo Flow (Phase 3)

### First-Time User Experience (4 MetaMask Popups):
1. **Avail Bridge Approval** (Base Sepolia) - One-time unlimited USDC approval for Avail bridge
2. **Bridge Transaction** (Base Sepolia) - Send USDC from Base to Sepolia via Avail
3. **Vault Approval** (Sepolia) - One-time unlimited USDC approval for AsyncVault
4. **Deposit Request** (Sepolia) - Request deposit to vault (operator bot claims automatically)

### Returning User Experience (2 MetaMask Popups):
1. **Bridge Transaction** (Base Sepolia) - Send USDC via Avail (approval already done)
2. **Deposit Request** (Sepolia) - Request deposit (approval already done, bot claims)

## Funding Requirements

To test the Avail bridge flow, we need to:
1. Fund demo account with **testnet ETH** on Base Sepolia (for gas)
2. Fund demo account with **USDC** on Base Sepolia (to bridge) - [Circle Faucet](https://faucet.circle.com/)
3. Keep Sepolia USDC balance at **zero** (to force bridge detection)

## Environment Variables

All accounts are configured in root `.env`:
- `DEPLOYER_ADDRESS` / `DEPLOYER_PRIVATE_KEY`
- `INVESTOR_ADDRESS` / `INVESTOR_PRIVATE_KEY` (same as deployer)
- `SIMULATOR_ADDRESS` / `SIMULATOR_PRIVATE_KEY`
- `DEMO_ADDRESS` / `DEMO_PRIVATE_KEY` (new - for Avail testing)

## USDC Addresses (Updated for Stability)

### Ethereum Sepolia (Destination)
- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Vault**: `0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9` (AsyncVault)

### Base Sepolia (Source - Most Stable)
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Faucet**: https://faucet.circle.com/

## Next Steps

1. ✅ Phase 1.1-1.2: Smart approval check + bot mode note
2. ✅ Phase 1.3: Generate demo account
3. ⏳ **Test current deposit/redeem flow** (verify no regression)
4. ⏳ Phase 1.4: Add "Approve USDC for Avail Bridge" button (Base Sepolia)
5. ⏳ Phase 2: Convert operator & simulator bots to Next.js API routes
6. ⏳ Phase 3: Integrate Avail Nexus auto-bridge (Base → Sepolia)
7. ⏳ Fund demo account with Base Sepolia USDC
8. ⏳ Test full cross-chain bridge flow

---

**Last Updated**: October 25, 2025
**Demo Account**: `0xd6B9214bb9e34C626144BdE31ca9e61DD4B2Af9E`
**Bridge Route**: Base Sepolia → Ethereum Sepolia (via Avail Nexus)
