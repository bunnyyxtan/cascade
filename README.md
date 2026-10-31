# Cascade

Programmable USDC financial-authority protocol for autonomous agent supply chains on [Arc](https://arc.io).

Built with [Arc Studio](https://studio.arc.io)

---

A client funds an objective in USDC, appoints a lead manager with a **delegation limit** and a **protected reserve**, and the manager allocates authorised funds to specialists — forming a tree of funded commitments. Commitments settle via approve / reject / cancel / expire, with USDC flowing to claimable balances on success and returning to the parent on failure.

The contract is immutable, has no admin keys, no proxy, no protocol fee, and no upgrade path.

---

## V1 capabilities

| Feature | Status |
|---------|--------|
| Root objective creation (fund + delegation limit) | ✅ |
| Child commitment delegation (nested, up to depth 8) | ✅ |
| Approve / reject / cancel / expire settlement | ✅ |
| Pull-based USDC claim | ✅ |
| Protected reserve at root | ✅ |
| Allocation tracking (`allocated` / `remaining`) | ✅ |
| Global event feed + per-wallet history | ✅ |
| Config verification on startup (codehash + USDC address) | ✅ |
| Responsive web UI (landing, explore, workspace, activity, claimable) | ✅ |

---

## Architecture overview

```
┌─────────────────────────────────────────────┐
│  React frontend (Vite + wagmi + ConnectKit) │
│  src/                                       │
│    components/  — UI pages and shell        │
│    hooks/       — contract read/write       │
│    lib/         — ABI, config, formatting   │
└────────────────────┬────────────────────────┘
                     │ viem / wagmi
┌────────────────────▼────────────────────────┐
│  Cascade.sol  (Arc Testnet)                 │
│  Immutable · no admin · USDC ERC-20 only    │
└─────────────────────────────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for a full component and money-flow diagram.

---

## Testnet deployment

| Network | Chain ID | Contract address |
|---------|----------|-----------------|
| Arc Testnet | 5042002 | [`0xa87371b1127d88df309313ddcaa43b6191fa9a57`](https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57) |

USDC on Arc (testnet and mainnet): `0x3600000000000000000000000000000000000000`

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| Wallet | wagmi v2, ConnectKit, viem |
| Smart contract | Solidity 0.8.28, OpenZeppelin 5.6.1 |
| Contract tests | Foundry (forge-std 1.16.2) |
| Frontend tests | Vitest 5, Testing Library |
| Linter | oxlint |
| Package manager | Bun |

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- [Foundry](https://getfoundry.sh) (`curl -L https://foundry.paradigm.sh | bash && foundryup`)
- A browser wallet (MetaMask, Coinbase Wallet, etc.) connected to Arc Testnet
- Test USDC from the [Arc Testnet faucet](https://studio.arc.io) (the "Get test USDC" button)

---

## Installation

```bash
git clone https://github.com/bunnyyxtan/cascade.git
cd cascade
bun install
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_NETWORK` | Yes | `testnet` or `mainnet` |
| `VITE_CASCADE_ADDRESS` | Yes | Deployed contract address |
| `VITE_CASCADE_DEPLOY_BLOCK` | Recommended | Block the contract was deployed at (speeds up event sync) |
| `VITE_CASCADE_CODEHASH` | Recommended | Runtime codehash for startup verification; absent → writes blocked |
| `VITE_RPC_PROXY_BASE_URL` | Arc Studio only | Injected automatically in Arc Studio |
| `VITE_RPC_PROXY_TOKEN` | Arc Studio only | Injected automatically in Arc Studio |
| `VITE_RPC_PROXY_CHAINS` | Arc Studio only | Injected automatically in Arc Studio |

---

## Running locally

```bash
bun run dev        # http://localhost:5173
```

The app connects to the network specified by `VITE_NETWORK`. On startup it verifies the contract's runtime bytecode hash and USDC address. Writes are blocked until verification passes.

---

## Building

```bash
bun run build      # TypeScript check + Vite production build → dist/
```

---

## Testing

### Frontend

```bash
bun run test       # 369 tests across 14 suites
```

### Smart contracts

```bash
bun run contracts:build   # compile
bun run contracts:test    # 76 tests: 60 unit, 10 fuzz, 6 invariant (Foundry)
```

### Lint and typecheck

```bash
bun run check      # oxlint + tsc (both steps, sequential)
bun run lint:check # lint only, no auto-fix
bun run typecheck  # tsc only
```

---

## Fetching the ABI

If you rebuild the contract and need to update the ABI used by the frontend:

```bash
bun run contracts:build
bun run fetch:abi
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/architecture.md`](docs/architecture.md) | System components and money flows |
| [`docs/contracts.md`](docs/contracts.md) | Contract interface, events, financial invariants |
| [`docs/development.md`](docs/development.md) | Local setup and developer workflow |
| [`docs/deployment.md`](docs/deployment.md) | Reproducible deployment and bytecode verification |
| [`docs/security.md`](docs/security.md) | Trust model, limitations, known risks |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines |
| [`SECURITY.md`](SECURITY.md) | Vulnerability reporting |
| [`CHANGELOG.md`](CHANGELOG.md) | Development history |
| [`AGENTS.md`](AGENTS.md) | Agent/AI contributor guide and accounting rules |

---

## License

MIT — see [LICENSE](LICENSE).

Foundry (`lib/forge-std`) is MIT licensed.
OpenZeppelin Contracts (`@openzeppelin/contracts`) is MIT licensed.
