# AsyncVault - ERC-7540 Async Vault with Avail Nexus

**ETHOnline 2025 Hackathon Project**

A single-chain ERC-7540 asynchronous vault with Avail Nexus integration for seamless user onboarding. Deposit USDC, earn simulated yields, and withdraw with guaranteed settlement via the reserve mechanism.

---

## 🎯 Current Status

✅ **AsyncVault Deployed & Verified**
- Contract: `0x8A73589fe295A64e9085708636cb04a29c9c4461`
- Network: Ethereum Sepolia
- Blockscout: [View Contract](https://eth-sepolia.blockscout.com/address/0x8A73589fe295A64e9085708636cb04a29c9c4461)

✅ **Frontend Working**
- Avail Nexus bridge integration
- USDC balance checking
- Vault deposit/redeem flow (with operator pattern)

⏳ **Next Steps**
- Build operator bot (auto-claim)
- Build market simulator bot (profit/loss)
- Deploy to AWS
- Set up Envio indexer

---

## 🚀 Quick Start

### Prerequisites
- Node.js v22+
- MetaMask with Sepolia ETH
- Testnet USDC from [faucet.circle.com](https://faucet.circle.com/)

### Install & Run

```bash
# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Using the Vault

1. **Connect Wallet** - MetaMask on Ethereum Sepolia
2. **Check Balance** - View your USDC and vault shares
3. **Bridge (Optional)** - Use Avail Nexus to bridge USDC from other testnets
4. **Deposit** - Request deposit → Approve claim transaction
5. **Redeem** - Request redeem → Approve claim transaction

---

## 📁 Project Structure

```
OpenSecret/
├── contracts-foundry/      # Foundry contracts
│   ├── src/
│   │   ├── AsyncVault.sol           # Main vault contract (ERC-7540)
│   │   └── interfaces/
│   │       └── IProfitLossRealizer.sol
│   ├── test/
│   │   └── AsyncVault.t.sol         # 25 comprehensive tests
│   └── script/
│       └── DeployAsyncVault.s.sol   # Deployment script
│
├── frontend/               # Next.js 14 app
│   ├── app/
│   │   └── page.tsx                 # Main UI
│   └── config/
│       ├── contracts.ts             # Contract addresses
│       └── AsyncVault.abi.json      # Contract ABI
│
├── docs/                   # Additional documentation
│   └── specs/
│       └── multi-chain-ERC4626/     # Original spec (archived)
│
├── DEPLOYMENT.md           # Deployment details
├── ARCHITECTURE.md         # Technical architecture
├── env.example             # Environment template
└── README.md               # This file
```

---

## 🏗️ Architecture

### Tech Stack

- **Smart Contracts:** Solidity ^0.8.20, Foundry
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Cross-Chain:** Avail Nexus (`@avail-project/nexus-widgets`)
- **Wallet:** MetaMask (via window.ethereum)

### Key Features

#### 1. ERC-7540 Asynchronous Vault
- **Two-step deposit/redeem flow** (request → claim)
- **Reserve mechanism** prevents underfunding during redemptions
- **Fair share pricing** based on actual USDC balance
- **Operator pattern** for automated claiming

#### 2. Profit/Loss Simulation
- Market simulator bot calls `realizeProfit(token, amount)`
- Directly transfers USDC to/from vault (no virtual accounting)
- Events emitted for indexer tracking

#### 3. Avail Nexus Integration
- Intent-based cross-chain bridging (~27s)
- Users can onboard from any supported testnet
- Minimal fees (~$0.001 for small amounts)

#### 4. Three-Account Architecture
| Role | Purpose |
|------|---------|
| **Deployer** | Contract owner, initial operator |
| **Investor** | End-user test account |
| **Simulator** | Market bot for profit/loss simulation |

---

## 🔗 Key Contracts

### AsyncVault (Sepolia)
- **Address:** `0x8A73589fe295A64e9085708636cb04a29c9c4461`
- **Owner:** `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba`
- **Operator:** `0x36AB88fDd34848C0caF4599736a9D3a860D051Ba`
- **Simulator:** `0x7EC14a7709A8dEF1CC0FD21cf617A2aF99990103`

### USDC (Circle Official)
- **Sepolia:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Arbitrum Sepolia:** `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d`
- **Base Sepolia:** `0x036cbd53842c5426634e7929541ec2318f3dcf7e`
- **OP Sepolia:** `0x5fd84259d66cd46123540766be93dfe6d43130d7`

### Avail Nexus
- **Bridge Contract:** `0xF0111EdE031a4377C34A4AD900f1E633E41055Dc`
- **Supported Chains:** Sepolia, Arbitrum, Base, Optimism, Polygon Amoy, Monad

---

## 🛠️ Development

### Environment Setup

```bash
# Copy example env
cp env.example .env

# Add your keys (see env.example for structure)
# DEPLOYER_PRIVATE_KEY, SIMULATOR_ADDRESS, etc.
```

### Smart Contract Development

```bash
cd contracts-foundry

# Build contracts
forge build

# Run tests
forge test

# Deploy to Sepolia
source .env
forge script script/DeployAsyncVault.s.sol:DeployAsyncVault \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC" \
  --broadcast

# Verify on Blockscout
forge verify-contract <ADDRESS> \
  src/AsyncVault.sol:AsyncVault \
  --verifier blockscout \
  --verifier-url https://eth-sepolia.blockscout.com/api \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,string,string)" \
    <USDC> <OPERATOR> <SIMULATOR> "Async USDC" "asUSDC") \
  --watch
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## 🎁 Prize Strategy

### Primary: **Avail Nexus Prize**
- ✅ Integrated Nexus SDK
- ✅ BridgeButton component for seamless UX
- ✅ Real cross-chain USDC transfers
- ✅ Intent-based execution

### Additional Potential Prizes:
- **Circle:** Using USDC as primary asset
- **Blockscout:** Development with Blockscout MCP
- **Foundry/Hardhat:** Testing infrastructure

---

## 📚 Documentation

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment details and instructions
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture and design decisions
- **[ERC7540_RESERVE_MECHANISM.md](docs/ERC7540_RESERVE_MECHANISM.md)** - Reserve mechanism explanation
- **[OPERATOR_PATTERN_EXPLAINED.md](docs/OPERATOR_PATTERN_EXPLAINED.md)** - Operator pattern details
- **[AVAIL_SUCCESS.md](docs/AVAIL_SUCCESS.md)** - Proof of working Avail bridge
- **[USDC_FAUCETS.md](docs/USDC_FAUCETS.md)** - Testnet USDC guide

---

## ⚠️ Known Issues

1. **MetaMask shows "Ethereum Mainnet" during Avail sign-in** - Cosmetic issue, transactions execute on correct network
2. **Multiple confirmations for ERC-7540** - Expected behavior for 2-step async flow (request + claim)
3. **Operator bot not yet deployed** - Manual claiming currently, bot implementation in progress

---

## 🧪 Testing

### Contract Tests
```bash
cd contracts-foundry
forge test -vvv
```

**Test Coverage:**
- 25 comprehensive tests
- 100% passing
- Covers deposits, redeems, profit/loss, reserves, edge cases

### Frontend Testing
1. Connect MetaMask to Sepolia
2. Get testnet USDC from [faucet.circle.com](https://faucet.circle.com/)
3. Test deposit flow (request → claim)
4. Test redeem flow (request → claim)
5. Test Avail bridge (optional)

---

## 🤝 Contributing

This is a hackathon project for ETHOnline 2025. After the hackathon, contributions will be welcome!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- **Avail Project** - Nexus SDK and intent-based bridging
- **Circle** - USDC on testnets
- **Blockscout** - Explorer API and MCP integration
- **OpenZeppelin** - Smart contract libraries
- **ETHGlobal** - Amazing hackathon platform

---

## 📞 Contact

Built by [@hamiha70](https://github.com/hamiha70) for ETHOnline 2025

---

**Status:** 🟢 Active Development  
**Last Updated:** October 24, 2025  
**Current Phase:** Frontend integration complete, building bots
