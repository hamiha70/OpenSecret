# 🧹 Repository Cleanup Plan

## 📊 CURRENT STATE ANALYSIS:

### Root-Level Documentation (17 MD files!):
1. ✅ **KEEP:** `AVAIL_SUCCESS.md` - Key achievement documentation
2. ✅ **KEEP:** `USDC_FAUCETS.md` - Useful reference
3. ✅ **KEEP:** `LICENSE` - Required
4. ✅ **KEEP:** `README.md` - Will be updated
5. 🗑️ **DELETE:** `AVAIL_BRIDGE_STATUS.md` - Superseded by AVAIL_SUCCESS.md
6. 🗑️ **DELETE:** `AVAIL_TESTING_PLAN.md` - Test complete, no longer needed
7. 🗑️ **DELETE:** `CHECK_EIP7702.md` - EIP-7702 not ready, not pursuing
8. 🗑️ **DELETE:** `CURRENT_STATUS.md` - Temporary file
9. 🗑️ **DELETE:** `EIP7702_IMPLEMENTATION_PLAN.md` - Not pursuing EIP-7702
10. 🗑️ **DELETE:** `GO_DECISION.md` - Decision made, no longer needed
11. 🗑️ **DELETE:** `IMPLEMENTATION_STATUS.md` - Outdated
12. 🗑️ **DELETE:** `MULTI_CHAIN_STATUS.md` - Outdated
13. 🗑️ **DELETE:** `NEXT_STEP.md` - Temporary
14. 🗑️ **DELETE:** `NEXT_STEPS.md` - Duplicate
15. 🗑️ **DELETE:** `TESTING_COMPLETE.md` - Outdated
16. 🗑️ **DELETE:** `TESTING_STATUS.md` - Outdated
17. 🗑️ **DELETE:** `VALIDATION_REPORT.md` - Outdated

### docs/specs/multi-chain-ERC4626/ (6 files):
1. ✅ **KEEP & CONSOLIDATE:** `PROJECT_SPECIFICATION.md` - Original spec (outdated but historical)
2. 🗑️ **DELETE:** `AVAIL_QUICK_TEST.md` - Test complete
3. ✅ **KEEP:** `BOT_ARCHITECTURE.md` - May need later
4. 🗑️ **DELETE:** `PROJECT_ANALYSIS_CROSS_CHAIN_VAULT.md` - Superseded
5. 🗑️ **DELETE:** `PROJECT_ARCHITECTURE_REFINED.md` - Outdated
6. 🗑️ **DELETE:** `TESTNET_USDC_GUIDE.md` - Covered in USDC_FAUCETS.md

### Test Files:
1. 🗑️ **DELETE:** `test-avail.html` - Superseded by Next.js frontend
2. 🗑️ **DELETE:** `avail-test/` - Old Node.js test, no longer needed
3. ⚠️ **KEEP:** `scripts/` - May need for vault deployment

### Scaffold:
1. 🗑️ **DELETE:** `scaffold-src/` - Extracted already, original not needed

### Other:
1. ✅ **KEEP:** `temp/` - Contains Discord logs and research
2. ✅ **KEEP:** `contracts/` - Will contain vault contracts
3. ✅ **KEEP:** `frontend/` - Active Next.js app
4. ✅ **KEEP:** `env.example` - Reference

---

## 🎯 CLEANUP ACTIONS:

### Phase 1: Delete Obsolete Docs (12 files)
```bash
rm AVAIL_BRIDGE_STATUS.md
rm AVAIL_TESTING_PLAN.md
rm CHECK_EIP7702.md
rm CURRENT_STATUS.md
rm EIP7702_IMPLEMENTATION_PLAN.md
rm GO_DECISION.md
rm IMPLEMENTATION_STATUS.md
rm MULTI_CHAIN_STATUS.md
rm NEXT_STEP.md
rm NEXT_STEPS.md
rm TESTING_COMPLETE.md
rm TESTING_STATUS.md
rm VALIDATION_REPORT.md
```

### Phase 2: Delete Old Test Files
```bash
rm test-avail.html
rm -rf avail-test/
```

### Phase 3: Clean docs/specs/
```bash
rm docs/specs/multi-chain-ERC4626/AVAIL_QUICK_TEST.md
rm docs/specs/multi-chain-ERC4626/PROJECT_ANALYSIS_CROSS_CHAIN_VAULT.md
rm docs/specs/multi-chain-ERC4626/PROJECT_ARCHITECTURE_REFINED.md
rm docs/specs/multi-chain-ERC4626/TESTNET_USDC_GUIDE.md
```

### Phase 4: Delete Scaffold Source
```bash
rm -rf scaffold-src/
```

### Phase 5: Reorganize Documentation
Create new structure:
```
docs/
  ├── PROJECT_SPEC.md (updated, comprehensive)
  ├── ARCHITECTURE.md (current architecture)
  ├── AVAIL_INTEGRATION.md (move AVAIL_SUCCESS.md here)
  └── archive/ (move outdated specs here, not delete)
```

---

## 📁 FINAL STRUCTURE:

```
OpenSecret/
├── README.md (updated)
├── LICENSE
├── env.example
├── package.json
├── contracts/ (vault contracts)
├── frontend/ (Next.js app)
├── scripts/ (deployment scripts)
├── docs/
│   ├── PROJECT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── AVAIL_INTEGRATION.md
│   ├── BOT_ARCHITECTURE.md
│   ├── USDC_FAUCETS.md
│   └── archive/
│       └── (old specs)
└── temp/ (Discord logs, research)
```

---

## ✅ BENEFITS:

1. **Clarity:** Only current, relevant docs
2. **Professionalism:** Clean repo for hackathon judges
3. **Maintainability:** Easy to find what matters
4. **Historical:** Archive old docs, don't delete

---

## 🚀 NEXT: PROJECT PLANNING REVIEW

After cleanup:
1. Review current architecture (USDC + Avail + ERC-7540)
2. Update project spec
3. Create implementation roadmap
4. Estimate time to completion
5. Decide on AWS deployment (later or now?)

