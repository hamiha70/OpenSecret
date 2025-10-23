
# Unchained Vaults — Cross-chain ERC-7540 with Avail Nexus + PYUSD (LayerZero) + EIP-7702

A hackathon scaffold demonstrating:
- **Unified base asset:** PYUSD via LayerZero (OFT / endpoints).
- **Per-chain ERC-7540 vault** (async 4626) with **bridged single share** design (pluggable).
- **Avail Nexus SDK** to route cross-chain deposit/withdraw *requests* and finalize *claims*.
- **EIP-7702** operator for policy-gated management (with fallback to plain EOA).

> Built as a monorepo: `contracts/` (Foundry) + `dapp/` (Next.js + wagmi + Avail Nexus widgets).

## Quickstart

### Prereqs
- Node 20+, pnpm 9+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Git

### Install
```bash
pnpm i
pnpm -r install
```

### Configure
- Copy envs and fill:
```bash
cp dapp/.env.example dapp/.env.local
```
Set RPCs, wallet project IDs, Avail Nexus keys (if required), LayerZero endpoints, and testnet token addresses (PYUSD, mock PYUSD, etc.).

### Build / Run
```bash
# Contracts
cd contracts && forge build && cd ..

# Web app
cd dapp && pnpm dev
```

## Avail Nexus Prize: How we qualify
- We use **nexus-widgets** for cross-chain *request/claim* flows (`Bridge & Execute` where possible).
- README documents integration + demo flow.
- Demo shows **crosschain intent** interaction (deposit on Chain A, claim on Chain B).

## PYUSD Prize: How we qualify
- PYUSD is the **underlying stable** and is **bridged programmatically** via LayerZero flows.
- Public repo, demo video, and explanation of real-world payment UX (async but single-click).

## Repo Layout
- `contracts/` — ERC-7540 `VaultX`, `Manager`, `Router`, share-bridge interfaces (stubs), libraries.
- `dapp/` — Next.js app with Avail Nexus widgets, wagmi, RainbowKit, 7702-operator toggle, simple indexer-free UI.
- `packages/shared/` — ABI + addresses autogeneration (typechain), shared utils.

## Notes
- This is a scaffold with **stubs** for LayerZero/PYUSD. Fill actual endpoint IDs and token addresses for your chosen testnets.
- The **bridged single share** is modeled via a mint/burn controller (message-verified). Start with per-chain shares if time-constrained; a flag toggles the UI behavior.

## License
MIT
