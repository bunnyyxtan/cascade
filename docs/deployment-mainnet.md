# Cascade V1 — Arc Mainnet Deployment Guide

> **The contract is immutable and has not been audited by an independent security firm.**
> Review all steps carefully. Real USDC is spent. Actions cannot be undone.

---

## Verified mainnet configuration

| Parameter | Value | Verification |
|---|---|---|
| Chain ID | 5042 | `eth_chainId` → `0x13b2` confirmed live |
| RPC | `https://rpc.mainnet.arc.io` | Public endpoint, Arc documentation |
| Explorer | `https://explorer.arc.io` | Arc documentation |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | `decimals()` → 6, `name()` → "USDC" confirmed live |
| USDC decimals | 6 | Live RPC call confirmed |
| Gas token | Native USDC (18-decimal view) | Arc documentation — same pool, different decimal precision |

> **Arc native gas note:** On Arc, native gas and ERC-20 USDC are the same asset exposed two ways.
> The contract uses 6-decimal ERC-20 USDC exclusively and never touches `msg.value`.
> Gas fees are deducted from your native balance (18-decimal view).
> Keep enough USDC in the deployer wallet to cover both the deployment gas and any initial testing.

---

## Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify compiler version
forge --version   # must be recent enough to support solc 0.8.28

# Clone the repository (if not already local)
git clone https://github.com/bunnyyxtan/cascade.git
cd cascade

# Install dependencies
bun install
```

---

## Step 1: Compile and verify the artifact

```bash
forge build

# Confirm the artifact exists and note the bytecode length
forge inspect Cascade bytecode | wc -c   # creation bytecode length in hex chars

# Compute keccak256 of the deployed (runtime) bytecode artifact — compare after deployment
cast keccak $(forge inspect Cascade deployedBytecode)
```

The artifact at `contracts/out/Cascade.sol/Cascade.json` must be built from
the current `contracts/Cascade.sol` source before deployment.

---

## Step 2: Run the full test suite

```bash
forge test -vv
```

Expected: **102 tests pass** (60 unit + 26 adversarial + 10 fuzz + 6 invariant).
Do not deploy if any test fails.

---

## Step 3: Set environment variables

```bash
# Never commit these or paste them into chat
export PRIVATE_KEY=0x<your_deployer_private_key>
export RPC_URL=https://rpc.mainnet.arc.io
```

Verify the deployer address and balance before broadcasting:

```bash
cast wallet address --private-key $PRIVATE_KEY
cast balance $(cast wallet address --private-key $PRIVATE_KEY) \
  --rpc-url $RPC_URL
```

The balance returned by `cast balance` is in native Arc units (18 decimals). To convert to the
familiar 6-decimal USDC amount, divide by 10^12. For example, a native balance of
`5000000000000` (5 × 10^12) equals 5.000000 USDC.

Gas costs vary with network conditions and cannot be stated precisely in advance.
Run the dry-run in Step 4 and read the estimated gas from the simulation output
before broadcasting. Contract deployment on Arc costs a modest amount of USDC;
the dry-run will show the exact estimate for current conditions.

---

## Step 4: Dry-run (no broadcast)

```bash
forge script contracts/script/DeployCascadeMainnet.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  -vvvv
```

The script enforces these checks at runtime before any broadcast:
- Chain ID must be exactly **5042** (Arc Mainnet)
- USDC `decimals()` must return **6**
- Deployer native balance must be **> 0**

If any check fails, the script reverts with a descriptive message. Fix the issue before proceeding.

Expected dry-run output includes:
```
Chain ID:        5042
USDC address:    0x3600000000000000000000000000000000000000
USDC decimals:   6
Deployer:        0x<your address>
```

---

## Step 5: Broadcast the deployment transaction

```bash
forge script contracts/script/DeployCascadeMainnet.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

Wait for the transaction to be included in a block. Arc has sub-second finality —
confirmation is nearly instant.

---

## Step 6: Record the deployment details

From the script output and `broadcast/DeployCascadeMainnet.s.sol/5042/run-latest.json`:

```
VITE_NETWORK=mainnet
VITE_CASCADE_ADDRESS=0x<deployed address>
VITE_CASCADE_DEPLOY_BLOCK=<block number from receipt>
```

Compute the runtime codehash (keccak256 of the deployed bytecode — this is what
`VITE_CASCADE_CODEHASH` and the frontend's fail-closed check both use):

```bash
cast keccak $(cast code 0x<deployed address> --rpc-url $RPC_URL)
```

Cross-check: this value must match what you computed from the artifact in Step 1,
confirming the onchain bytecode matches the local build.

Record this as `VITE_CASCADE_CODEHASH`.

---

## Step 7: Verify the deployed contract

```bash
# Check usdc() returns the correct address
cast call 0x<deployed address> "usdc()(address)" --rpc-url $RPC_URL

# Check nextId() is 1 (Cascade initializes _nextId = 1; first commitment gets id 1)
cast call 0x<deployed address> "nextId()(uint256)" --rpc-url $RPC_URL

# Check totalEscrowed is 0
cast call 0x<deployed address> "totalEscrowed()(uint256)" --rpc-url $RPC_URL

# Check totalClaimable is 0
cast call 0x<deployed address> "totalClaimable()(uint256)" --rpc-url $RPC_URL
```

Expected values: `usdc()` = `0x3600000000000000000000000000000000000000`,
`nextId()` = `1`, `totalEscrowed()` = `0`, `totalClaimable()` = `0`.
If any value differs, **do not proceed**.

---

## Step 8: Configure Vercel environment variables

In the Vercel dashboard for `arc-studio-e23c745a31a74c88a93e7f30.vercel.app`:

1. Go to **Settings → Environment Variables**
2. Set (Production only):

| Variable | Value |
|---|---|
| `VITE_NETWORK` | `mainnet` |
| `VITE_CASCADE_ADDRESS` | `0x<actual mainnet address>` |
| `VITE_CASCADE_DEPLOY_BLOCK` | `<actual deployment block>` |
| `VITE_CASCADE_CODEHASH` | `0x<runtime keccak256>` |

3. Do **not** set `VITE_RPC_PROXY_BASE_URL` or `VITE_RPC_PROXY_TOKEN` — these are Arc Studio only
4. Redeploy from the Vercel dashboard (or trigger via Arc Studio)

---

## Step 9: Smoke test the live mainnet app

After the frontend redeploys:

- [ ] Page title shows "Arc Mainnet" (not "Arc Testnet")
- [ ] Contract codehash verification passes (green indicator)
- [ ] USDC address shown matches `0x3600...`
- [ ] `nextId` shows 1 (fresh deployment; no commitments yet)
- [ ] Event history starts from the new deployment block
- [ ] Wallet USDC balance reads correctly
- [ ] Objective creation form targets the correct contract address
- [ ] No credentials visible in browser DevTools → Sources

---

## Deployment record (fill in after deployment)

```
Contract address:    <to be filled>
Transaction hash:    <to be filled>
Block number:        <to be filled>
Deployer address:    <to be filled>
Gas paid (USDC):     <to be filled>
Constructor arg:     0x3600000000000000000000000000000000000000
Runtime codehash:    <to be filled>
Explorer:            https://explorer.arc.io/address/<to be filled>
Deployed:            <date>
```

---

## Known risks before mainnet

### M-01: Constructor has no chain ID or USDC address guard (Medium)

The constructor only checks `usdcAddress != address(0)`. The deployment script adds
these guards externally, but the deployed contract itself does not enforce chain ID
or USDC address at the Solidity level.

**Mitigation:** The deployment script (`DeployCascadeMainnet.s.sol`) enforces both
checks before broadcasting and verifies `usdc()` after deployment. Run the dry-run
first and confirm the output matches expected values.

**Effect on deployment:** None, provided the script is used as written.

### M-02: Permissionless expiry racing approved submissions

Any address can expire a submitted commitment once the deadline passes.
A third party gains no USDC from doing so — the refund goes to the client.
See `docs/security-review.md` for full analysis and adversarial test results.

**Decision:** Accept. Tested and documented. No contract change required.

### No independent audit

The contract has 102 automated tests but has not been reviewed by an
independent security firm. Use amounts proportional to this risk.

---

*Last updated: 2026-10-31*
