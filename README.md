<p align="center">
  <img src="docs/assets/cascade-logo-readme.png" alt="Cascade" width="180" />
</p>

<h1 align="center">Cascade</h1>

<p align="center">
  Onchain USDC commitments, delegation and settlement on Arc.
</p>

<p align="center">
  <a href="https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57">Arc Testnet</a>
  ·
  <a href="docs/architecture.md">Architecture</a>
  ·
  <a href="docs/contracts.md">Contract reference</a>
  ·
  <a href="docs/security-review.md">Security review</a>
  ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

Cascade is a programmable USDC financial-authority protocol. A client funds an objective in USDC, appoints a lead manager with a **delegation limit** and a **protected reserve**, and the manager allocates authorised funds to specialists — forming a tree of funded commitments. Each commitment settles via approve, reject, cancel, or expire, with USDC flowing to claimable balances on success and returning up the tree on failure.

The smart contract is immutable, has no admin keys, no proxy, no protocol fee, and no upgrade path.

## How it works

```
Client funds a root commitment
  └── Manager allocates to child commitments (up to depth 8)
        └── Workers submit delivery references
              └── Approvers settle: approve → payout, reject/cancel/expire → refund
```

- **Delegation limit** — the manager can only allocate up to this amount downstream; the remainder stays as a protected reserve.
- **Allocation tracking** — `allocated` tracks live + settled exposure so freed slots from failed children can be reused.
- **Pull-based claims** — successful payouts go to a `claimable` balance; workers claim at their own pace.
- **Permissionless expiry** — anyone can expire any commitment whose deadline has passed and whose children are terminal, enabling bottom-up recovery of locked funds.

## Testnet deployment

| Network | Chain ID | Contract |
|---------|----------|---------|
| Arc Testnet | 5042002 | [`0xa87371b1127d88df309313ddcaa43b6191fa9a57`](https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57) |

USDC on Arc (testnet and mainnet): `0x3600000000000000000000000000000000000000` · 6 decimals

## Architecture

```
┌─────────────────────────────────────────────┐
│  React frontend (Vite + wagmi + ConnectKit) │
│  src/                                       │
│    components/  — UI pages and shell        │
│    content/     — docs site and legal pages │
│    hooks/       — contract read/write       │
│    lib/         — ABI, config, formatting   │
└────────────────────┬────────────────────────┘
                     │ viem / wagmi
┌────────────────────▼────────────────────────┐
│  Cascade.sol  (Arc Testnet)                 │
│  Immutable · no admin · USDC ERC-20 only    │
│  SafeERC20 · ReentrancyGuard · Checks-      │
│  Effects-Interactions throughout            │
└─────────────────────────────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for a full component and money-flow diagram.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| Wallet | wagmi v2, ConnectKit, viem |
| Smart contract | Solidity 0.8.28, OpenZeppelin 5.6.1 |
| Contract testing | Foundry — forge-std 1.16.2 |
| Frontend testing | Vitest 5, Testing Library, axe-core |
| Linter | oxlint |
| Package manager | Bun |

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 — `curl -fsSL https://bun.sh/install | bash`
- [Foundry](https://getfoundry.sh) — `curl -L https://foundry.paradigm.sh | bash && foundryup`
- A browser wallet (MetaMask, Coinbase Wallet, etc.)
- Arc Testnet added to your wallet — RPC: `https://rpc.testnet.arc.io`, Chain ID: `5042002`

## Installation

```bash
git clone https://github.com/bunnyyxtan/cascade.git
cd cascade
bun install
cp .env.example .env
# Edit .env — see Environment variables below
```

Forge-std is vendored under `lib/forge-std/` (plain copy, no submodule). OpenZeppelin resolves via `node_modules/@openzeppelin/contracts/` through `remappings.txt`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_NETWORK` | Yes | `testnet` to connect to Arc Testnet |
| `VITE_CASCADE_ADDRESS` | Yes | Deployed contract address |
| `VITE_CASCADE_DEPLOY_BLOCK` | Recommended | Deploy block — speeds up event history sync |
| `VITE_CASCADE_CODEHASH` | Recommended | Runtime codehash — absent means writes are blocked |
| `VITE_SITE_URL` | Optional | Canonical URL for the deployed site |
| `VITE_RPC_PROXY_BASE_URL` | Arc Studio only | Injected automatically in Arc Studio |
| `VITE_RPC_PROXY_TOKEN` | Arc Studio only | Injected automatically in Arc Studio |
| `VITE_RPC_PROXY_CHAINS` | Arc Studio only | Injected automatically in Arc Studio |

The testnet values for `VITE_CASCADE_ADDRESS`, `VITE_CASCADE_DEPLOY_BLOCK`, and `VITE_CASCADE_CODEHASH` are in `.env.example`.

## Running locally

```bash
bun run dev         # → http://localhost:5173
```

On startup the app verifies the on-chain runtime codehash and USDC address against the configured RPC. Writes are blocked until verification passes.

## Building

```bash
bun run build       # TypeScript check + Vite production build → dist/
```

## Testing

### Frontend

```bash
bun run test        # 369 tests across 14 suites
```

### Smart contracts

```bash
bun run contracts:build   # compile with Foundry
bun run contracts:test    # 102 tests: 60 unit + 10 fuzz + 6 invariant + 26 adversarial
```

### Lint and typecheck

```bash
bun run check       # oxlint + tsc (sequential)
bun run check:type  # typography enforcer (sub-12px, inline fontSize, bare literals)
```

## Updating the ABI

If you recompile the contract and need to update the frontend ABI:

```bash
bun run contracts:build
bun run fetch:abi
```

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/architecture.md`](docs/architecture.md) | System components and USDC flow diagram |
| [`docs/contracts.md`](docs/contracts.md) | Contract interface, events, accounting invariants |
| [`docs/development.md`](docs/development.md) | Local setup and developer workflow |
| [`docs/deployment.md`](docs/deployment.md) | Reproducible deployment and bytecode verification |
| [`docs/security.md`](docs/security.md) | Trust model, limitations, known risks |
| [`docs/security-review.md`](docs/security-review.md) | Full security review with adversarial test results |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines |
| [`SECURITY.md`](SECURITY.md) | Vulnerability reporting policy |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |
| [`AGENTS.md`](AGENTS.md) | AI contributor guide and accounting invariants |

## Security

The contract has not undergone a professional third-party audit. Do not use on mainnet with real funds before an independent audit is completed. See [`docs/security-review.md`](docs/security-review.md) for the current review status and [`SECURITY.md`](SECURITY.md) for the vulnerability reporting policy.

## License

MIT — see [LICENSE](LICENSE).

`lib/forge-std` is MIT licensed. `@openzeppelin/contracts` is MIT licensed.
