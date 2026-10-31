# Development guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Bun](https://bun.sh) | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| [Foundry](https://getfoundry.sh) | latest stable | `curl -L https://foundry.paradigm.sh \| bash && foundryup` |
| Browser wallet | any | MetaMask, Coinbase Wallet, etc. |

---

## First-time setup

```bash
git clone https://github.com/bunnyyxtan/cascade.git
cd cascade
bun install
cp .env.example .env
# Edit .env — fill in VITE_NETWORK, VITE_CASCADE_ADDRESS, etc.
```

Foundry libraries are vendored under `lib/forge-std/` (plain directory copy, not a git submodule). No `git submodule update` is required. OpenZeppelin is resolved via `node_modules/@openzeppelin/contracts/` through the remapping in `remappings.txt`.

---

## Running the frontend

```bash
bun run dev
# → http://localhost:5173
```

The app reads `VITE_NETWORK` from `.env`. On startup it verifies the contract's runtime codehash and USDC address against the configured RPC. Writes are blocked until verification passes.

---

## Building for production

```bash
bun run build
# TypeScript check + Vite build → dist/
```

---

## Frontend tests

```bash
bun run test
# 369 tests across 14 suites (vitest)
```

Test files live in `src/test/`. They cover:

| File | Tests |
|------|-------|
| `status.test.ts` | Commitment status classification |
| `nextStep.test.ts` | Next-action derivation |
| `funds.test.ts` | Balance and accounting helpers |
| `outcome.test.ts` | computeOutcome against testnet fixtures |
| `amount.test.tsx` | Amount component rendering |
| `walletGate.test.tsx` | WalletGate states |
| `a11y.test.tsx` | Axe accessibility scan (WalletGate disconnected) |
| `fontsize.test.tsx` | Typography token compliance |
| `activity.test.ts` | Activity event field correctness |
| `router.test.ts` | Pathname router |
| `contentRoutes.test.tsx` | Content route rendering (docs site) |
| `docsContent.test.ts` | Docs markdown loading and raw import validation |
| `linkCrawler.test.tsx` | Dead-link check across all content routes |
| `rootNav.test.tsx` | Reactive root navigation |

---

## Contract tests

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test -vv
```

Foundry test files:

| File | Coverage |
|------|----------|
| `contracts/test/Cascade.t.sol` | 60 unit tests — all write paths, permission guards, accounting |
| `contracts/test/CascadeFuzz.t.sol` | 10 fuzz tests + 6 invariant tests |
| `contracts/test/CascadeAdversarial.t.sol` | 26 adversarial tests — expiry races, deep trees, 16-child limit, accounting invariants |

Total: **102 tests**.

---

## Lint and typecheck

```bash
bun run check       # oxlint + tsc (sequential, both always run)
bun run lint:check  # lint only, no auto-fix
bun run typecheck   # tsc --noEmit only
bun run check:type  # custom typography enforcer (scripts/check-type.ts)
```

`check:type` enforces three rules across all TSX/CSS source:

1. **SUB12** — no CSS `font-size` below 12px/0.75rem (with documented exceptions for Landing.tsx)
2. **INLINE** — no `fontSize` key in JSX `style={{ }}` (documented exceptions: Amount.tsx, Landing.tsx, main.tsx)
3. **LITERAL** — no bare rem/px literals in CSS; must use `var(--text-*)`, `var(--num-*)`, or `var(--fs-*)`

---

## Fetching the ABI

If you recompile the contract and need to update the frontend ABI:

```bash
bun run contracts:build
bun run fetch:abi
# Updates src/lib/cascadeAbi.ts from contracts/out/Cascade.sol/Cascade.json
```

`src/lib/cascadeAbi.ts` is the sole ABI source for all viem contract calls. Do not edit it manually.

---

## Design system

Design tokens are defined in `src/styles/tokens.css` and mirrored in `tailwind.config.js`. The full colour palette, type scale, and motion tokens are documented there.

Run the contrast checker:

```bash
bun run scripts/contrast-check.ts
# 20/20 WCAG AA pairs passing
```

---

## What not to change

The following files are locked. Changes to them require separate explicit review:

| File | Reason |
|------|--------|
| `contracts/Cascade.sol` | Deployed contract — its bytes feed the codehash |
| `src/lib/cascadeAbi.ts` | Extracted from compiled artifact — only update via `fetch:abi` |
| `src/lib/configCheck.ts` | Config verification logic — changes affect write gating |
| `src/lib/history.ts` | Event store accounting — changes affect activity and outcome display |
| `src/hooks/useCascadeWrite.ts` | Write hooks — changes affect transaction submission |
| Financial accounting logic in hooks and `outcome.ts` | Every number shown comes from contract state |
