# 🔄 Restart Services After Config Change

## Why Restart?

When you update `.env` or `frontend/.env.local`, running services don't automatically pick up the changes.  
You MUST restart them for the new vault address to take effect!

---

## ✅ Quick Restart Guide

### 1. Stop All Services

In each terminal running a service, press `Ctrl+C` to stop it.

### 2. Start Frontend (Terminal 1)

**IMPORTANT:** Next.js caches server-side env vars. You MUST clear cache!

```bash
cd /home/hamiha70/Projects/ETHGlobal/ETHOnline2025/OpenSecret/frontend
rm -rf .next/cache
npm run dev
```

Or just kill all Next.js processes:
```bash
pkill -9 -f "next dev"
cd /home/hamiha70/Projects/ETHGlobal/ETHOnline2025/OpenSecret/frontend
npm run dev
```

### 3. Start Operator Bot (Terminal 2)

```bash
cd /home/hamiha70/Projects/ETHGlobal/ETHOnline2025/OpenSecret/operator-bot
npm start
```

### 4. Verify Config

Check the startup logs to confirm the correct vault address:

**Frontend should show:**
```
AsyncVault on Arbitrum Sepolia - Ready!
```

**Operator Bot should show:**
```
📍 Vault:    0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
🔗 Chain:    arbitrum-sepolia (421614)
```

**Market Simulator should show** (in Next.js logs):
```
[Market Simulator] Connected to arbitrum-sepolia (Chain 421614)
```

---

## 🚫 Signs of Wrong Address

If you see these in logs, services are using the OLD (failed) address:

❌ `0xf286AE673A1a78bFb1FE1b5A24634FFdDDb815AA` - OLD FAILED DEPLOYMENT  
❌ `execution reverted (no data present; likely require(false) occurred`  
❌ `Vault Total USDC: NaN`

---

## ✅ Current Config (Arbitrum Sepolia)

**From `.env`:**
```bash
# Frontend
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
NEXT_PUBLIC_VAULT_CHAIN_ID=421614
NEXT_PUBLIC_VAULT_CHAIN_NAME="Arbitrum Sepolia"

# Backend (bots)
VAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
```

**From `frontend/.env.local`:**
```bash
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
VAULT_ADDRESS=0x604737c0Ae78cE6C8391eDfEA08f1D8077677d09
```

---

## 🔄 To Switch Chains Later

Just update `.env` and `frontend/.env.local`, then restart all services!

**Example - Switch to Ethereum Sepolia:**
```bash
# Update .env
NEXT_PUBLIC_ASYNCVAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9
NEXT_PUBLIC_VAULT_CHAIN_ID=11155111
NEXT_PUBLIC_VAULT_CHAIN_NAME="Ethereum Sepolia"
VAULT_ADDRESS=0x065EB36e5d33c35fd8C510fF2f42C41D2b3FdAf9

# Restart all services (Ctrl+C, then npm run dev / npm start)
```

No code changes needed! 🎉
