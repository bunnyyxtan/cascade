# Architecture

## Overview

Cascade is a single-contract, single-chain protocol paired with a React frontend. There is no backend server, no oracle, no indexer service, and no off-chain state. All money movements are onchain.

```
Browser
  │
  ├── Landing page (unauthenticated)
  │     Layout.tsx + Landing.tsx
  │
  └── App shell (wallet connected)
        AppShell.tsx
          ├── Explore.tsx        — commitment list, search, filter
          ├── CommitmentWorkspace.tsx — tree, inspector, actions
          ├── CreateRoot.tsx     — approve + createRoot two-step
          ├── Activity.tsx       — global event feed
          └── Claimable view     — USDC balance + claim history
                │
                │  wagmi / viem  (read: eth_call, eth_getLogs)
                │               (write: eth_sendTransaction)
                │
          Arc RPC (mainnet or testnet)
                │
          Cascade.sol  ─── USDC ERC-20 (0x3600…)
```

---

## Frontend layers

### Pages

| File | Route / purpose |
|------|----------------|
| `src/components/Landing.tsx` | Unauthenticated marketing page |
| `src/components/Explore.tsx` | All commitments with filter, sort, group |
| `src/components/CommitmentWorkspace.tsx` | Per-commitment detail, actions, child tree |
| `src/components/CreateRoot.tsx` | Fund a new root objective |
| `src/components/Activity.tsx` | Global event log |
| `src/components/AppShell.tsx` | Authenticated shell; also owns the claimable view |

### Hooks

| Hook | Responsibility |
|------|---------------|
| `useCascade.ts` | Read commitment data, children, nextId, claimable balance |
| `useCascadeWrite.ts` | All write operations (createRoot, delegate, approve, reject, cancel, expire, claim) |
| `useCascadeEvents.ts` | Activity feed and wallet-scoped commitment list from the history store |
| `useInvalidate.ts` | Invalidates wagmi query cache after writes |
| `useUsdcBalance.ts` | USDC ERC-20 balance and allowance |
| `useConfigCheck.ts` | Drives the config-verification singleton |

### Libraries

| File | Purpose |
|------|---------|
| `src/lib/cascadeAbi.ts` | ABI extracted from compiled artifact — source of truth for viem calls |
| `src/lib/contracts.ts` | Contract address, chain, explorer URL helpers |
| `src/lib/network.ts` | Active network (VITE_NETWORK), CHAIN object, RPC URL |
| `src/lib/configCheck.ts` | Startup verification singleton (codehash + USDC address) |
| `src/lib/history.ts` | Chunked `eth_getLogs` event store, localStorage cache, 15 s poll |
| `src/lib/types.ts` | TypeScript mirrors of contract structs and enums |
| `src/lib/format.ts` | USDC formatting, address shortening, deadline helpers |
| `src/lib/outcome.ts` | Pure `computeOutcome` — maps event history to per-node outcome lines |
| `src/lib/status.ts` | Commitment status classification helpers |
| `src/lib/toast.ts` | Sonner toast helpers |

---

## Money flows

### Fund a root objective

```
Client wallet
  │  USDC.approve(Cascade, amount)
  └─► Cascade.createRoot(manager, amount, delegationLimit, deadline, title)
          └─► USDC.transferFrom(client, Cascade, amount)
                  totalEscrowed += amount
                  commitment.remaining = amount
```

### Delegate to a specialist

```
Manager wallet
  └─► Cascade.createChild(parentId, manager, amount, deadline, title)
          parent.remaining -= amount
          child.remaining   = amount
          totalEscrowed unchanged (already in contract)
          root.allocated   += amount  (delegation guard, root children only)
```

### Approve (success path)

```
Approver wallet
  └─► Cascade.approve(id)
          commitment.state = Succeeded
          claimable[manager] += remaining
          totalEscrowed     -= remaining
          totalClaimable    += remaining
          parent.allocated  -= remaining  (if non-root)
```

### Failure path (reject / cancel / expire)

```
  └─► Cascade.reject(id)  /  cancel(id)  /  expire(id)
          commitment.state = Failed
          parent.remaining += remaining   (unspent returned)
          root.allocated   -= remaining   (reusable delegation)
          totalEscrowed    -= remaining
```

### Claim

```
Manager wallet
  └─► Cascade.claim()
          USDC.safeTransfer(manager, claimable[manager])
          totalClaimable -= amount
```

---

## Accounting invariants

These invariants hold after every transaction. The contract enforces them implicitly through its state transitions; the frontend reads them and never estimates.

```
totalEscrowed  == sum of all commitment.remaining
totalClaimable == sum of all claimable[address]
usdc.balanceOf(Cascade) >= totalEscrowed + totalClaimable
```

The balance check is `>=` not `==`: unsolicited ERC-20 transfers into the contract do not inflate recorded obligations and cannot break the invariant.

---

## Config verification on startup

Before any write is allowed, the frontend calls three read methods against the configured RPC:

1. `eth_chainId` — must match `CHAIN_ID`
2. `eth_getCode(CASCADE_ADDRESS)` — `keccak256` of the result must match `VITE_CASCADE_CODEHASH`
3. `Cascade.usdc()` — must return `0x3600000000000000000000000000000000000000`

All three checks are managed by the `configCheck` singleton (`src/lib/configCheck.ts`). Writes are gated in `WalletGate` until `status === 'ok'`. If `VITE_CASCADE_CODEHASH` is absent the status is `'unverified'` and writes are permanently blocked.

---

## Arc Studio instrumentation

`src/tracing.ts` and `src/console-capture.ts` are Arc Studio preview utilities. They are loaded only when the app detects it is running inside an `studio.arc.io` parent frame. They are not loaded in production deployments or in any environment outside the Studio sandbox.
