# Cross-Chain Vault with Avail Nexus

**ETHOnline 2025 Hackathon Project**

A cross-chain ERC-7540 async vault with intent-based bridging powered by Avail Nexus. Bridge USDC across testnets in ~27 seconds with minimal fees.

---

## 🎯 Project Status

✅ **Phase 1: COMPLETE**
- Working Avail Nexus integration
- Cross-chain USDC transfer verified
- Transaction: `0x24a36c2b36a8ef79efb488b95bbd8784058c320a1954154d08feb407e9e8f82f`

🔄 **Phase 2: IN PROGRESS**
- ERC-7540 vault contracts
- Frontend integration

---

## 🚀 Quick Start

### Prerequisites
- Node.js v22+
- MetaMask with Sepolia ETH
- Testnet USDC from [faucet.circle.com](https://faucet.circle.com/)

### Install & Run

```bash
# Install dependencies
npm install

# Start frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

### Test Avail Bridge

1. Connect MetaMask wallet
2. Check USDC balance
3. Click "Bridge USDC with Avail Nexus"
4. Complete all MetaMask approvals
5. Wait ~27 seconds
6. Verify on Nexus Intent Explorer

---

## 📁 Project Structure

```
OpenSecret/
├── README.md
├── LICENSE
├── env.example
├── contracts/          # Vault smart contracts (coming soon)
├── frontend/           # Next.js app with Avail integration
├── scripts/            # Deployment scripts
├── docs/
│   ├── PROJECT_SPEC.md         # Current specification
│   ├── AVAIL_SUCCESS.md        # Successful bridge test
│   ├── USDC_FAUCETS.md         # Testnet USDC guide
│   ├── BOT_ARCHITECTURE.md     # Bot design (stretch goal)
│   └── archive/                # Old specifications
└── temp/               # Research & Discord logs
```

---

## 🏗️ Architecture

### Tech Stack

- **Smart Contracts:** Solidity, Foundry, ERC-7540
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Cross-Chain:** Avail Nexus (`@avail-project/nexus-widgets`)
- **Wallet:** MetaMask (Wagmi/RainbowKit ready)

### How It Works

1. **Deposit:** User deposits USDC into vault
2. **Yield:** Vault deploys capital to yield strategies
3. **Rebalance:** Bot triggers cross-chain rebalancing via Avail
4. **Bridge:** Avail Nexus executes intent-based cross-chain transfer (~27s)
5. **Withdraw:** User can withdraw from any supported chain

---

## ✅ Verified Achievement

### Successful Cross-Chain Bridge

**Transaction Details:**
- Hash: `0x24a36c2b36a8ef79efb488b95bbd8784058c320a1954154d08feb407e9e8f82f`
- From: Ethereum Sepolia
- To: Arbitrum Sepolia
- Amount: 0.1 USDC
- Time: 27.2 seconds
- Fees: 0.000701 USDC (~$0.001)
- Intent ID: 874 (SUCCESS)

**Evidence:**
- [Blockscout Transaction](https://eth-sepolia.blockscout.com/tx/0x24a36c2b36a8ef79efb488b95bbd8784058c320a1954154d08feb407e9e8f82f)
- Nexus Intent Explorer (Intent ID 874)
- See `docs/AVAIL_SUCCESS.md` for full analysis

---

## 🎁 Prize Strategy

### Primary: **Avail Nexus Prize**
- ✅ Integrated Nexus SDK
- ✅ Real cross-chain transfer
- ✅ Intent-based execution
- ✅ Verifiable on-chain

### Additional Potential Prizes:
- **Circle:** Using USDC
- **Blockscout:** Development tooling
- **Hardhat/Foundry:** Testing infrastructure

---

## 🔗 Key Contracts

### USDC (Official Circle Deployments)
- **Sepolia:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Arbitrum Sepolia:** `0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d`
- **Base Sepolia:** `0x036cbd53842c5426634e7929541ec2318f3dcf7e`
- **OP Sepolia:** `0x5fd84259d66cd46123540766be93dfe6d43130d7`

### Avail Infrastructure
- **Bridge Contract:** `0xF0111EdE031a4377C34A4AD900f1E633E41055Dc`
- **Supported Chains:** Sepolia, Arbitrum Sepolia, Base Sepolia, OP Sepolia, Polygon Amoy, Monad Testnet

---

## 📚 Documentation

- **[Project Specification](docs/PROJECT_SPEC.md)** - Full project details
- **[Avail Success Report](docs/AVAIL_SUCCESS.md)** - Bridge test analysis
- **[USDC Faucets](docs/USDC_FAUCETS.md)** - Get testnet USDC
- **[Bot Architecture](docs/BOT_ARCHITECTURE.md)** - Rebalancing logic (future)

---

## 🛠️ Development

### Environment Setup

```bash
# Copy example env
cp env.example .env

# Add your private key
# MAIN_PRIVATE_KEY=your_private_key_here
# ETHEREUM_SEPOLIA_RPC=your_rpc_url
```

### Testing (Coming Soon)

```bash
# Run contract tests
forge test

# Run frontend tests
cd frontend && npm test
```

---

## ⚠️ Known Issues

1. **MetaMask shows "Ethereum Mainnet" during Avail sign-in** - This is cosmetic, transactions go to correct network
2. **PYUSD not supported** - Avail only supports USDC/USDT (verified in Discord)
3. **Testnet limitations** - Limited solver liquidity, occasional delays

---

## 🤝 Contributing

This is a hackathon project for ETHOnline 2025. After the hackathon, contributions will be welcome!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- **Avail Project** - Nexus SDK and fast intent-based bridging
- **Circle** - USDC on testnets
- **Blockscout** - Explorer API and MCP integration
- **ETHGlobal** - Amazing hackathon platform

---

## 📞 Contact

Built by [@hamiha70](https://github.com/hamiha70) for ETHOnline 2025

---

**Status:** 🟢 Active Development  
**Last Updated:** October 24, 2025  
**Next Milestone:** Deploy ERC-7540 vault contracts
