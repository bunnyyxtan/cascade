# Cascade — contributor and agent guide

Cascade is a programmable USDC financial-authority protocol for autonomous agent supply chains.
A client funds an objective in USDC, appoints a lead manager with a delegation limit and
protected reserve, and the manager allocates authorised funds to specialists — forming a
funded commitment tree. Commitments settle via approve / reject / cancel / expire, with USDC
flowing to claimable balances on success and returning to the parent on failure.

---

## Deployed contract

| Network | Chain ID | Address | Deploy block |
|---------|----------|---------|--------------|
| Arc Testnet | 5042002 | `0xa87371b1127d88df309313ddcaa43b6191fa9a57` | 69,056,151 |
| Arc Mainnet | 5042 | _pending deployment_ | _pending_ |

**Testnet** deploy tx: [`0x0e07…2a6a`](https://explorer.testnet.arc.io/tx/0x0e07a498c287e26481ea5150968741dea3210e2ad1c0a552bcd15f508fa82a6a)
Testnet runtime codehash (keccak256): `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29`

**Mainnet deployment:** Run `contracts/script/DeployCascadeMainnet.s.sol` from your own machine.
See `docs/deployment-mainnet.md` for the complete step-by-step guide.
After deployment, update this table and the Vercel environment variables.

USDC on Arc (testnet and mainnet): `0x3600000000000000000000000000000000000000` (6 decimals)

---

## Key source files

| File | Purpose |
|------|---------|
| `contracts/Cascade.sol` | Immutable core protocol — do not modify |
| `src/lib/cascadeAbi.ts` | ABI extracted from compiled artifact — do not modify |
| `src/lib/network.ts` | Single source of truth for active network (VITE_NETWORK) |
| `src/lib/contracts.ts` | Contract address, TARGET_CHAIN, explorer helpers |
| `src/lib/configCheck.ts` | Startup contract verification store (singleton) |
| `src/lib/history.ts` | Event history store — 1000-block chunks, sequential, 150ms pacing, 30s poll |
| `src/lib/types.ts` | TypeScript mirrors of contract structs and enums |
| `src/lib/format.ts` | USDC formatting, address shortening, deadline helpers |
| `src/hooks/useCascade.ts` | Read hooks: commitment, children, nextId, claimable |
| `src/hooks/useCascadeWrite.ts` | Write hooks + useSuccessOnce callback helper |
| `src/hooks/useCascadeEvents.ts` | Activity feed and wallet commitment list from history store |
| `src/hooks/useInvalidate.ts` | wagmi query cache invalidation after writes |
| `src/hooks/useUsdcBalance.ts` | USDC ERC-20 balance and allowance reads |
| `src/components/AppShell.tsx` | Authenticated app shell: sidebar, topbar, claims view |
| `src/components/CommitmentWorkspace.tsx` | Commitment detail, actions, child tree, outcome/funds blocks |
| `src/components/CreateRoot.tsx` | Two-step approve + createRoot flow |
| `src/components/Explore.tsx` | Commitment table with search and filters |
| `src/components/Activity.tsx` | Global event feed with syncing progress |
| `src/components/Landing.tsx` | Landing page (unauthenticated) |

---

## Accounting invariants (never change these)

- `root.allocated` tracks live + settled exposure, not cumulative history.
  On child failure: `allocated -= child.remaining` (unspent portion freed).
- `delegationLimit − allocated` = reusable delegation capacity shown in the UI.
- `budget − delegationLimit` = protected reserve, unreachable until root resolves.
- Contract balance invariant: `balance >= totalEscrowed + totalClaimable`.
- USDC on Arc is the 6-decimal ERC-20 at `0x3600…`. The native balance (18-decimal)
  is the same pool — never show both or sum them.

---

## History store

- Chunks: 9,000 blocks, ≤4 in flight, checkpoint saved after each batch.
- Cache key: `cascade:history:{chainId}:{contractAddress}` in localStorage.
- Deploy block read from `VITE_CASCADE_DEPLOY_BLOCK`; falls back to `head − 10,000`.
- Poll interval: 15 s. Tab visibility change triggers a re-sync after > 5 min idle.

---

## Config verification

On startup the app calls `eth_chainId`, `eth_getCode`, and `Cascade.usdc()` on RPC_URL.
Writes are gated in `WalletGate` until all three checks pass and `result.key` matches
`EXPECTED_CONFIG_KEY`. Timeout per call: 10 s. Failure → `'error'` (retryable), not silent pass.
`VITE_CASCADE_CODEHASH` absent → `'unverified'` (writes blocked).

---

## Development rules

- Do not modify `contracts/Cascade.sol` — its bytes feed the metadata hash and the
  deployed codehash must stay reproducible.
- Do not modify `src/lib/cascadeAbi.ts` — it is extracted from the compiled artifact.
- Do not modify write hooks, permission rules, or accounting logic.
- Every write entry point must be inside a `<WalletGate>`.
- Every number shown in the UI comes from contract state or decoded events — never estimated.

---

## Running locally

```bash
cp .env.example .env   # fill in your values
bun install
bun run dev            # http://localhost:5173
```

## Contract tests

```bash
forge test             # 76 Foundry tests: 60 unit, 10 fuzz, 6 invariant
```

## Build

```bash
bun run build          # tsc + vite build
```

---

## Foundry dependencies

| Library | Version | Location |
|---------|---------|---------|
| forge-std | 1.16.2 | `lib/forge-std/` (plain copy; see `.gitmodules` for submodule pin) |
| OpenZeppelin contracts | 5.6.1 | `node_modules/@openzeppelin/contracts/` via remapping |

For CI: `bun install` (pulls OZ), then either `git submodule update --init` (if using
the submodule) or ensure `lib/forge-std/` is present. The `remappings.txt` file
must remain committed so Foundry resolves both libraries correctly.
