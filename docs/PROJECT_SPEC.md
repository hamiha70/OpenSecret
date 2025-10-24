# OmniVault: Chain-Agnostic Yield Vault

## ETHOnline 2025 Hackathon Project

**Status:** ✅ Architecture Finalized - Ready to Build  
**Deadline:** Sunday, October 27, 2025  
**Tagline:** "One vault. Any chain. Seamless yield."

---

## 🎯 Value Proposition

> Access high-yield DeFi from ANY chain. Deposit USDC from Arbitrum, Base, OP, or any chain - earn yield on Sepolia. Withdraw to any chain. Powered by Avail Nexus for seamless ~27-second bridging.

**Key Innovation:** First yield vault with true chain-agnostic access through intent-based bridging + operator-automated claiming.

---

## ✅ COMPLETED (Phase 1)

### Avail Nexus Integration ✅
- ✅ Next.js frontend with `@avail-project/nexus-widgets`
- ✅ MetaMask wallet connection
- ✅ Working cross-chain USDC bridge (verified on-chain)
- ✅ Transaction: `0x24a36c2b36a8ef79efb488b95bbd8784058c320a1954154d08feb407e9e8f82f`
- ✅ Intent ID: 874 (SUCCESS)
- ✅ Speed: 27.2 seconds
- ✅ Cost: $0.001

**Documentation:** `docs/AVAIL_SUCCESS.md`

---

## 🚧 IN PROGRESS (Phase 2)

### Smart Contracts (ERC-7540)
- 🔄 OmniVault.sol (async vault with operator pattern)
- 🔄 MockStrategy.sol (yield simulation)
- 🔄 Deploy to Ethereum Sepolia
- 🔄 Integration tests

### Frontend Integration
- 🔄 Connect to vault contract
- 🔄 One-click deposit (Avail + operator)
- 🔄 Auto-claiming via frontend polling
- 🔄 Withdraw flow with multi-chain support

---

## 🏗️ Architecture

### System Flow

```
User (ANY Chain) 
    ↓ One-Click Deposit
Avail Nexus Bridge (~27s, $0.001)
    ↓
OmniVault (Sepolia) - ERC-7540 Async
    ├─ requestDeposit (instant)
    ├─ Frontend polls & auto-claims
    ├─ User receives shares
    └─ Yield strategy deploys capital
    
Withdraw:
    ├─ requestRedeem (instant)
    ├─ Frontend auto-claims USDC
    └─ Optional: Avail bridge to any chain
```

### Tech Stack

**Smart Contracts:**
- Solidity ^0.8.20
- Foundry for development
- ERC-7540 async vault
- Operator pattern for UX
- OpenZeppelin contracts

**Frontend:**
- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- Avail Nexus Widgets
- Wagmi for wallet connection
- Frontend polling for auto-claims

**Cross-Chain:**
- Avail Nexus for user-facing operations
- USDC as primary asset
- Single-chain vault (Sepolia)
- Multi-chain user access

---

## 🎯 Key Features

### 1. Chain-Agnostic Deposits ⭐⭐⭐
Users can deposit from ANY supported chain:
- Arbitrum, Base, Optimism, Polygon, Sepolia
- Frontend auto-triggers Avail bridge
- ~27 seconds, ~$0.001 cost
- Seamless UX

### 2. One-Click UX ⭐⭐⭐
Operator pattern eliminates multiple transactions:
- User: requestDeposit (one click)
- Frontend: Auto-polls and claims
- Result: Shares appear automatically
- No waiting, no second click

### 3. ERC-7540 Async ⭐⭐
Perfect fit for bridging latency:
- Non-blocking requests
- User can leave during processing
- Claim when ready
- Better UX than synchronous vaults

### 4. Multi-Chain Withdrawals ⭐⭐
Withdraw to any chain:
- Redeem on Sepolia (instant)
- Bridge to destination via Avail (optional)
- Integrated flow, feels seamless

---

## 🏆 Prize Strategy

### Primary: Avail Nexus ($5,000-$10,000)
- ✅ Using Nexus SDK
- ✅ Novel use case (chain-agnostic vault access)
- ✅ Real value proposition
- ✅ Working demo with verified transaction

### Secondary: Circle USDC ($1,000-$2,500)
- ✅ USDC as primary asset
- ✅ Multi-chain support
- ✅ Demonstrating USDC utility across chains

### Potential: Blockscout
- ✅ Used MCP for development
- ✅ Transaction verification
- ✅ Multi-chain monitoring

---

## 📋 Implementation Roadmap

### Phase 1: ✅ COMPLETE (Avail Integration)
- [x] Frontend with Avail Nexus
- [x] Wallet connection
- [x] Cross-chain bridge verification
- [x] Architecture design

### Phase 2: 🔄 IN PROGRESS (Core Vault)
**Est. 3-4 hours**
- [ ] OmniVault.sol (ERC-7540 + Operator)
- [ ] MockStrategy.sol
- [ ] Deployment script
- [ ] Basic tests

### Phase 3: ⏳ NEXT (Frontend Integration)
**Est. 2-3 hours**
- [ ] Connect to deployed vault
- [ ] Operator approval flow
- [ ] Frontend polling for auto-claims
- [ ] Deposit UI integration
- [ ] Withdraw UI

### Phase 4: 🎯 FINAL (Polish & Demo)
**Est. 1-2 hours**
- [ ] End-to-end testing
- [ ] UX refinements
- [ ] Documentation
- [ ] Video demo

### Phase 5: 🌟 STRETCH (If Time Permits)
- [ ] Backend operator bot
- [ ] Second pool (different chain)
- [ ] Real yield strategy
- [ ] Envio dashboard

**Total MVP: 6-9 hours**

---

## 📊 Key Decisions

### ✅ **ERC-7540 (Not ERC-4626)**
Async design fits Avail's latency perfectly

### ✅ **Operator Pattern**
Automated claiming for one-click UX

### ✅ **Frontend Polling MVP**
Realistic for hackathon, upgradeable to backend bot

### ✅ **Single-Chain Vault**
Simpler, faster to build, still achieves value prop

### ✅ **Avail Only (No LayerZero)**
Sponsor prize + better UX for user-facing operations

### ❌ **No Envio (For Now)**
Focus on core vault first

---

## 🔗 Key Contracts

### USDC (Official Circle Deployments)
- **Sepolia:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Arbitrum Sepolia:** `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d`
- **Base Sepolia:** `0x036cbd53842c5426634e7929541ec2318f3dcf7e`
- **OP Sepolia:** `0x5fd84259d66cd46123540766be93dfe6d43130d7`

### Avail Infrastructure
- **Bridge Contract:** `0xF0111EdE031a4377C34A4AD900f1E633E41055Dc`
- **Supported Chains:** Sepolia, Arbitrum Sepolia, Base Sepolia, OP Sepolia, Polygon Amoy

---

## 📚 Documentation

- **[ARCHITECTURE_FINAL.md](ARCHITECTURE_FINAL.md)** - Complete architecture
- **[AVAIL_SUCCESS.md](AVAIL_SUCCESS.md)** - Bridge test verification
- **[ERC7540_UX_SOLUTION.md](ERC7540_UX_SOLUTION.md)** - Operator pattern details
- **[AVAIL_NEXUS_VAULT_ASSESSMENT.md](AVAIL_NEXUS_VAULT_ASSESSMENT.md)** - Technical analysis
- **[USDC_FAUCETS.md](USDC_FAUCETS.md)** - Get testnet USDC

---

## 🎤 Pitch

### 30-Second Version:
> "DeFi pools are locked to single chains. If you have USDC on Arbitrum but the best yield is on Sepolia, you're stuck. OmniVault solves this: deposit from any chain, earn yield anywhere, withdraw to any chain. Powered by Avail Nexus for seamless 27-second bridging. True chain-agnostic DeFi."

### Technical Highlight:
> "ERC-7540 async vault with operator pattern + Avail Nexus intent-based bridging. One-click deposit from any chain, automated claiming, seamless UX. First vault with true cross-chain accessibility."

---

## ⚠️ Known Limitations

1. **Single-chain investment:** Vault invests on Sepolia only (not multi-chain)
2. **Testnet only:** Limited solver liquidity on testnets
3. **USDC only:** PYUSD not supported by Avail
4. **Frontend polling:** Users must keep browser open (upgradeable to bot)

---

## 📄 License

MIT License - See [LICENSE](../LICENSE)

---

**Status:** 🚀 **Ready to Build Core Vault**  
**Last Updated:** October 24, 2025  
**Next Milestone:** Deploy OmniVault.sol to Sepolia (Est. 3-4 hours)
