# Changelog

## [2025-10-24] - Deployment & Cleanup

### ✅ Deployed
- **AsyncVault** to Ethereum Sepolia: `0x31144B67A0003f88a53c011625DCC28713CeB9AB`
- Verified on Blockscout
- Updated frontend with new contract address and ABI

### 📚 Documentation Restructure
- Moved all technical docs to `/docs/` folder for cleaner root
- Consolidated and removed 15+ legacy/redundant documentation files
- Created comprehensive `ARCHITECTURE.md`, `DEPLOYMENT.md`
- Added `.cursorrules` for project conventions

### 🗑️ Removed
**Root Level:**
- ACCOUNT_SETUP_GUIDE.md → consolidated
- ASYNCVAULT_COMPLETE.md → superseded
- BUG_FIX_FUNCTION_SELECTORS.md → historical
- CLOSURE_BUG_FIX.md → historical
- CONTRACT_COMPLETE.md → superseded by DEPLOYMENT.md
- DEBUGGING_GUIDE.md → historical
- DEPLOYMENT_READY.md → superseded by DEPLOYMENT.md
- DEPLOYMENT_SUCCESS.md → superseded by DEPLOYMENT.md
- FRONTEND_INTEGRATION_COMPLETE.md → superseded
- OPERATOR_DEMO_PLAN.md → implementation plan
- PROFIT_LOSS_DESIGN.md → outdated design (removed virtualProfitLoss)
- SESSION_SUMMARY.md → session notes
- STATUS.md → superseded by README.md
- TRANSACTION_RECONSTRUCTION.md → historical debugging
- UX_BUG_FIX.md → historical
- VERIFICATION_SUCCESS.md → superseded by DEPLOYMENT.md

**`/docs/` folder:**
- ARCHITECTURE_DISCUSSION.md → superseded
- ARCHITECTURE_FINAL.md → superseded
- AVAIL_NEXUS_VAULT_ASSESSMENT.md → historical
- BOT_ARCHITECTURE.md → covered in ARCHITECTURE.md
- CLEANUP_SUMMARY.md → session notes
- ERC7540_UX_SOLUTION.md → covered in OPERATOR_PATTERN_EXPLAINED.md
- HARDHAT_VS_FOUNDRY.md → decision made
- PROJECT_SPEC.md → superseded by README.md
- archive/PROJECT_SPECIFICATION.md → old spec

**`/scripts/` folder:**
- Removed entire folder (legacy EIP-7702 test scripts)

### 📁 Final Structure
```
OpenSecret/
├── README.md                      # Project overview
├── .cursorrules                   # Project conventions
├── CHANGELOG.md                   # This file
├── LICENSE
├── env.example
├── contracts-foundry/             # Foundry contracts
│   ├── src/AsyncVault.sol
│   ├── test/AsyncVault.t.sol
│   └── script/DeployAsyncVault.s.sol
├── frontend/                      # Next.js app
│   ├── app/page.tsx
│   └── config/
│       ├── contracts.ts
│       └── AsyncVault.abi.json
└── docs/                          # All documentation
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── ERC7540_RESERVE_MECHANISM.md
    ├── OPERATOR_PATTERN_EXPLAINED.md
    ├── AVAIL_SUCCESS.md
    └── USDC_FAUCETS.md
```

### 🔄 Contract Changes
- Renamed from `OmniVault` to `AsyncVault`
- Removed `virtualProfitLoss` (simplified to direct USDC transfers)
- Implemented reserve mechanism for ERC-7540 compliance
- Updated to 3-account architecture (Deployer, Investor, Simulator)

### 🎯 Next Steps
- [ ] Build operator bot (auto-claim)
- [ ] Build market simulator bot (profit/loss)
- [ ] Deploy bots to AWS
- [ ] Set up Envio indexer
- [ ] Create dashboard UI

---

## [2025-10-23] - Previous Work

### Completed
- ERC-7540 vault implementation
- Operator pattern
- Comprehensive testing (25 tests)
- Frontend integration
- Avail Nexus bridge testing
- Bug fixes (function selectors, React closures)

