# Testnet USDC: How to Get It (or Mock It)

**Decision:** Mock USDC is MUCH easier and faster for a 5-day hackathon.

---

## Option 1: Deploy Mock USDC (RECOMMENDED) ⭐

### Why Mock USDC?

**Advantages:**
- ✅ **Fast:** Deploy in 5 minutes on all 3 chains
- ✅ **Unlimited supply:** Mint as much as you need for testing
- ✅ **No faucet limits:** No 24-hour rate limits
- ✅ **Full control:** You control minting, perfect for demo
- ✅ **Same interface:** ERC-20, works identically to real USDC
- ✅ **Judges accept this:** Standard hackathon practice

**Disadvantages:**
- ⚠️ Not "real" USDC (but judges don't care)
- ⚠️ Need to deploy on 3 chains (15 minutes total)

### Implementation

**Mock USDC Contract (MockUSDC.sol):**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, 1_000_000 * 10**6); // 1M USDC (6 decimals)
    }

    function decimals() public pure override returns (uint8) {
        return 6;  // USDC has 6 decimals, not 18
    }

    // Anyone can mint (for easy testing)
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    // Faucet function (users can claim 1000 USDC)
    function faucet() public {
        _mint(msg.sender, 1000 * 10**6); // 1000 USDC
    }
}
```

**Deployment Script (deploy-mock-usdc.ts):**

```typescript
import { ethers } from "hardhat";

async function main() {
    console.log("Deploying Mock USDC...");

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const address = await usdc.getAddress();
    console.log(`✅ Mock USDC deployed to: ${address}`);

    // Mint some tokens for testing
    const [deployer] = await ethers.getSigners();
    await usdc.faucet();
    const balance = await usdc.balanceOf(deployer.address);
    console.log(`   Deployer balance: ${ethers.formatUnits(balance, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

**Deploy to 3 chains:**

```bash
# Arbitrum Sepolia
npx hardhat run scripts/deploy-mock-usdc.ts --network arbitrumSepolia

# Optimism Sepolia
npx hardhat run scripts/deploy-mock-usdc.ts --network optimismSepolia

# Base Sepolia
npx hardhat run scripts/deploy-mock-usdc.ts --network baseSepolia
```

**Total time: 15 minutes for all 3 chains.**

---

## Option 2: Real Testnet USDC (NOT RECOMMENDED)

### Why NOT Real USDC?

**Disadvantages:**
- 🔴 **Slow:** Faucets have 24-hour rate limits
- 🔴 **Limited supply:** Often only 10-100 USDC per request
- 🔴 **Unreliable:** Faucets often dry up or break
- 🔴 **Time sink:** Can take hours to get enough tokens
- 🔴 **Regional locks:** Some faucets don't work outside US

**Only use real USDC if:**
- You want to show "production-like" integration
- You have 1-2 days to wait for faucets
- You're willing to risk faucet failures

### How to Get Real Testnet USDC

#### Arbitrum Sepolia USDC

**Faucet:** https://faucet.circle.com/

**Steps:**
1. Connect wallet
2. Select "Arbitrum Sepolia"
3. Request 10 USDC
4. Wait 24 hours for next request

**Contract Address:** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (Circle USDC)

---

#### Optimism Sepolia USDC

**Option A: Bridge from Sepolia**
1. Get USDC on Ethereum Sepolia (Circle faucet)
2. Bridge via Optimism Gateway: https://app.optimism.io/bridge
3. Wait 10-30 minutes

**Option B: Faucet (if available)**
- Check https://faucet.circle.com/ for Optimism support

---

#### Base Sepolia USDC

**Option A: Bridge from Ethereum Sepolia**
1. Get USDC on Ethereum Sepolia
2. Bridge via Base Bridge: https://bridge.base.org/
3. Wait 10-30 minutes

**Option B: Use Base Sepolia Faucet**
- https://faucet.quicknode.com/base/sepolia (may have USDC support)

---

### Real USDC Addresses (Testnet)

| Chain | USDC Contract | Source |
|-------|---------------|--------|
| Ethereum Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Circle |
| Arbitrum Sepolia | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Circle |
| Optimism Sepolia | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` | Circle |
| Base Sepolia | Check docs (may not exist) | - |

**⚠️ Warning:** These addresses may change. Verify at https://developers.circle.com/stablecoins/docs/usdc-on-test-networks

---

## Option 3: Hybrid Approach (Mock for Demo, Real for "Production" Claim)

**Strategy:**
1. Deploy Mock USDC for development & demo (Day 1-4)
2. On Day 5, if time allows, swap to real USDC
3. In demo, mention: "Using mock USDC for testnet, would use Circle USDC on mainnet"

**Pros:**
- ✅ Fast development (no faucet waiting)
- ✅ Can claim "production-ready" architecture
- ✅ Judges understand this approach

**Cons:**
- ⚠️ Extra work to swap contracts on Day 5 (may not be worth it)

---

## Recommendation

**For a 5-day hackathon:** 🏆 **Deploy Mock USDC**

**Why:**
- You'll spend 15 minutes deploying vs 1-2 days waiting for faucets
- Judges care about architecture, not whether USDC is "real"
- Production deployment would use real USDC anyway (easy swap)
- You can mint unlimited tokens for testing multiple scenarios

**Time saved:** 1-2 days → Better spent on vault logic, UI, demo polish

---

## Implementation Checklist

**If using Mock USDC (recommended):**

- [ ] Copy MockUSDC.sol contract above
- [ ] Deploy to Arbitrum Sepolia (5 min)
- [ ] Deploy to Optimism Sepolia (5 min)
- [ ] Deploy to Base Sepolia (5 min)
- [ ] Mint 10,000 USDC to your wallet on each chain (1 min)
- [ ] Update vault contracts to use Mock USDC addresses
- [ ] **Total time: ~20 minutes**

**If using Real USDC (not recommended):**

- [ ] Request from Circle faucet (Day 1)
- [ ] Wait 24 hours
- [ ] Request again (Day 2)
- [ ] Wait 24 hours
- [ ] Bridge to Optimism/Base (Day 3)
- [ ] Wait for bridge confirmation (30 min - 2 hours)
- [ ] Finally have enough USDC to test (Day 3 afternoon)
- [ ] **Total time: 2-3 days** 🔴

---

## For Demo Presentation

**What to say:**

> "We're using a mock USDC token for testnet demonstration. The architecture is identical to production—we'd simply swap the token address to Circle's USDC contract. The ERC-20 interface is the same, so the vault logic requires zero changes."

**Judges will ask:** "Why not real USDC?"

**Your answer:**
> "Real testnet USDC has faucet rate limits (10 USDC per 24 hours). For a 5-day hackathon, mock tokens let us focus on the novel cross-chain architecture rather than fighting faucets. On mainnet, we'd use Circle USDC—same 6-decimal ERC-20 interface."

**Judges will say:** "Makes sense. Show me the cross-chain rebalancing."

---

## Mock USDC vs Real USDC: No Functional Difference

```solidity
// Your vault code works identically with both:

IERC20 usdc = IERC20(USDC_ADDRESS);  // Mock or real, doesn't matter

function deposit(uint256 amount) public {
    usdc.transferFrom(msg.sender, address(this), amount);
    // ... vault logic
}

function withdraw(uint256 shares) public {
    uint256 assets = convertToAssets(shares);
    usdc.transfer(msg.sender, assets);
    // ... vault logic
}
```

**The only difference:** Where you get tokens (mint vs faucet).

---

## Final Answer to Your Question

**"Should I get real testnet USDC or mock it?"**

➜ **Mock it.** Deploy MockUSDC in 15 minutes. Save 2 days.

**"But what if judges care?"**

➜ They don't. They've seen hundreds of hackathon projects with mock tokens. They care about:
- Architecture (cross-chain coordination) ✅
- Standards compliance (ERC-4626) ✅
- Working demo (deposit → rebalance → withdraw) ✅

**"When would I use real USDC?"**

➜ Only if:
- You have 2+ days to spare (you don't)
- Real USDC adds demo value (it doesn't)
- You want to show "production integration" (mock works equally well)

---

**Verdict: Deploy Mock USDC. Start coding vaults. Don't waste time on faucets.** ⏰

