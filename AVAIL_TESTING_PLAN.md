# Avail Nexus Testing Plan

## ❌ Why We Can't Test Avail in Node.js

Avail Nexus SDK **requires**:
- Browser environment (window object)
- EIP-1193 provider (MetaMask, WalletConnect, etc.)
- User wallet interaction
- React/Next.js frontend

**Cannot test in Node.js backend!**

---

## ✅ When We'll Test Avail

**During Frontend Build (Day 2):**

1. **Setup Next.js app**
   ```bash
   npx create-next-app@latest
   ```

2. **Install Avail SDK**
   ```bash
   npm install @availproject/nexus-widgets
   ```

3. **Add widget to page**
   ```jsx
   import { BridgeWidget } from '@availproject/nexus-widgets';
   
   <BridgeWidget
     sourceChain="ethereum-sepolia"
     destChain="arbitrum-sepolia"
     token={PYUSD_ADDRESS}
   />
   ```

4. **Test in browser**
   - Connect wallet
   - Click widget
   - Try to bridge 1 PYUSD
   - Verify transaction

---

## 📋 What We Know (From Docs)

**Supported Chains:**
- ✅ Ethereum Sepolia (we have 200 PYUSD)
- ✅ Arbitrum Sepolia (we have 100 PYUSD)
- ✅ Optimism Sepolia
- ✅ Base Sepolia

**SDK Components:**
- `@availproject/nexus` - Core SDK
- `@availproject/nexus-widgets` - React components
- `@availproject/nexus-elements` - Web components

**What Nexus Does:**
- User submits "intent" (e.g., "bridge PYUSD to Arbitrum")
- Nexus finds best execution path
- Handles cross-chain message passing
- Delivers assets to destination chain

---

## 🎯 Our Integration Plan

**Step 1:** Build vault contracts (TODAY)
**Step 2:** Build frontend with Avail widget (DAY 2)
**Step 3:** Test Avail in browser (DAY 2)
**Step 4:** Integrate with vault logic (DAY 3)

**We'll test Avail when the time is right - in the browser!** 🌐

