# Cross-Chain Vault with Avail Nexus

## ETHOnline 2025 Hackathon Project

**Status:** ✅ Phase 1 Complete (Avail Integration)  
**Deadline:** Sunday, October 27, 2025  
**Team:** Solo project  

---

## 🎯 Project Overview

### Elevator Pitch

"A cross-chain ERC-7540 async vault that bridges assets using Avail Nexus for intent-based cross-chain execution. Users deposit USDC, and the system can rebalance across chains via fast, low-cost bridging."

### Core Innovation

- **ERC-7540 Async Vault:** Asynchronous deposit/redeem for delayed settlement scenarios
- **Avail Nexus Integration:** Intent-based cross-chain bridging (27-second execution, <$0.001 fees)
- **Multi-Chain Support:** Deploy on Sepolia, Arbitrum Sepolia, Base Sepolia, OP Sepolia
- **USDC as Primary Asset:** Officially supported by Avail Nexus

---

## ✅ COMPLETED (Phase 1):

### 1. Avail Nexus Integration ✅
- ✅ Next.js frontend with `@avail-project/nexus-widgets`
- ✅ MetaMask wallet connection with multi-provider support
- ✅ Automatic network detection & switching
- ✅ USDC balance reading across chains
- ✅ Working cross-chain bridge (verified transaction)

**Evidence:**
- Transaction: `0x24a36c2b36a8ef79efb488b95bbd8784058c320a1954154d08feb407e9e8f82f`
- Intent ID: 874 (SUCCESS)
- Time: 27.2 seconds
- Fees: 0.000701 USDC
- See `docs/AVAIL_SUCCESS.md` for full details

---

## 🚧 IN PROGRESS (Phase 2):

### 2. Vault Contracts (ERC-7540)
- 🔲 VaultX.sol (async ERC-7540 vault)
- 🔲 Deploy to Ethereum Sepolia
- 🔲 Integration tests

### 3. Frontend Integration
- 🔲 Connect frontend to vault
- 🔲 Deposit/withdraw UI
- 🔲 Cross-chain rebalance flow

---

## 🏗️ Architecture

### Tech Stack

**Smart Contracts:**
- Solidity ^0.8.20
- Foundry for development & testing
- ERC-7540 async vault interface
- OpenZeppelin contracts

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Avail Nexus Widgets (`@avail-project/nexus-widgets`)
- Wagmi/RainbowKit for wallet connection

**Cross-Chain:**
- Avail Nexus for intent-based bridging
- USDC as primary asset (officially supported)
- Multi-chain deployment (Sepolia, Arbitrum Sepolia, Base Sepolia, OP Sepolia)

### System Flow

```
User → Deposit USDC → Vault (Sepolia)
                         ↓
                    Yield strategies
                         ↓
              Rebalance needed? → Avail Bridge → Destination chain
                         ↓
                    User Withdraw
```

---

## 🎁 Prize Strategy

### Primary Target: **Avail Nexus Prize**
- ✅ Integrated Nexus SDK
- ✅ Real cross-chain transfer working
- ✅ Intent-based bridging (not direct bridge)
- ✅ Verifiable on-chain evidence

### Potential Additional Prizes:
- **Circle (USDC):** Using USDC as primary asset
- **Blockscout:** Used MCP for development & verification
- **Hardhat/Foundry:** Comprehensive testing (to be added)

---

## 📋 Implementation Roadmap

### Phase 1: ✅ COMPLETE
- [x] Frontend setup
- [x] Wallet connection
- [x] Avail Nexus integration
- [x] Verify cross-chain transfer

### Phase 2: 🔄 IN PROGRESS (Est. 3-4 hours)
- [ ] Write VaultX.sol (ERC-7540)
- [ ] Deploy to Sepolia
- [ ] Integration tests
- [ ] Connect frontend to vault

### Phase 3: ⏳ PENDING (Est. 2-3 hours)
- [ ] Deposit/withdraw UI
- [ ] Cross-chain rebalance demo
- [ ] End-to-end testing
- [ ] Documentation cleanup

### Phase 4: 🎯 STRETCH GOALS (If time permits)
- [ ] Deploy to multiple chains
- [ ] Add yield strategy (mock or real)
- [ ] AWS hosting with Terraform
- [ ] Bot simulation

---

## 📊 Key Decisions

### ✅ **USDC over PYUSD**
- **Reason:** Avail Nexus does not support PYUSD (confirmed in Discord)
- **Impact:** Can't apply for PayPal prize, but Avail prize is more valuable

### ✅ **ERC-7540 over ERC-4626**
- **Reason:** Async vault better fits cross-chain bridging delays
- **Impact:** More novel, better architecture for intent-based execution

### ✅ **Intent-based bridging (Avail) over direct bridging (LayerZero)**
- **Reason:** Avail is sponsor, LayerZero is not
- **Impact:** Prize eligibility, also Avail is faster (27s vs minutes)

### ⏳ **AWS Deployment: Later**
- **Reason:** Focus on core functionality first
- **Impact:** Can deploy to AWS after hackathon if needed

---

## 🔗 Resources

### Documentation
- `docs/AVAIL_SUCCESS.md` - Successful bridge test
- `docs/USDC_FAUCETS.md` - Testnet USDC faucets
- `docs/BOT_ARCHITECTURE.md` - Bot design (stretch goal)
- `docs/archive/` - Old specifications

### Key Contracts
- USDC Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- USDC Arbitrum Sepolia: `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d`
- Avail Bridge: `0xF0111EdE031a4377C34A4AD900f1E633E41055Dc`

### External Links
- [Avail Nexus Docs](https://docs.availproject.org/nexus/nexus-cheatsheet)
- [ERC-7540 Spec](https://eips.ethereum.org/EIPS/eip-7540)
- [Circle USDC Faucet](https://faucet.circle.com/)

---

## 🎊 Success Metrics

### Hackathon Submission Requirements:
- ✅ Working demo (Avail bridge)
- 🔲 Smart contracts deployed
- 🔲 Frontend accessible
- 🔲 GitHub repo clean & documented
- 🔲 Video demo

### Prize Requirements:
- ✅ Avail Nexus SDK integration
- ✅ Real cross-chain transfer
- ✅ On-chain verification
- 🔲 Vault contracts deployed

---

## ⚠️ Known Limitations

1. **PYUSD not supported:** Avail doesn't support PYUSD, only USDC/USDT
2. **EIP-7702 not ready:** Pectra upgrade not fully deployed on testnets yet
3. **MetaMask UI quirk:** Shows "Ethereum Mainnet" during Avail sign-in (harmless)
4. **Testnet liquidity:** Avail solvers have limited testnet liquidity

---

## 📝 License

MIT License - See `LICENSE` file

---

**Last Updated:** October 24, 2025  
**Next Milestone:** Deploy vault contracts (Est. 3-4 hours)

