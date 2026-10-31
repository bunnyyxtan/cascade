# Overview

Cascade is a programmable financial-authority protocol. A client funds an outcome in USDC, sets a delegation limit, and the manager they appoint can further delegate portions of that budget to specialists — all enforced by an immutable smart contract on Arc, with no admin key, no protocol fee, and no upgrade path.

## What the tree model means

Every funded objective is a **root commitment**. The client is the one who transfers USDC into escrow and who ultimately approves or rejects the root outcome. The client appoints a **manager**, who is responsible for the work.

If the manager needs specialist help, they can create **child commitments** directly under the root, each with their own budget, deadline, and manager. Those specialists can in turn delegate further, creating a tree up to 8 levels deep with up to 16 direct children per node.

```
Root (#1)  — 10 USDC
├── Child (#2)  — 4 USDC  (specialist A)
│   └── Child (#4)  — 2 USDC  (sub-specialist)
└── Child (#3)  — 3 USDC  (specialist B)
```

The unallocated portion of the root (in this example, 3 USDC) stays reserved for the client and is never exposed to delegation.

## Roles

| Role | Who they are | What they can do |
|------|-------------|-----------------|
| **Client** | Funds the root; becomes its approver | Approve, reject, cancel the root |
| **Manager** | Appointed at creation; responsible for delivery | Create children, submit delivery |
| **Approver** | Parent's manager (for children), or the client (for the root) | Approve, reject, cancel |

Role assignments are set at commitment creation and **cannot be changed**.

## How money moves

1. Client approves a USDC spend and calls `createRoot` — tokens move into the contract.
2. Manager delegates portions to specialists via `createChild` — no additional USDC transfer; this is internal accounting only.
3. Each specialist submits their work with a delivery reference (`submit`).
4. The approver reviews and either approves (releasing USDC to the manager's claimable balance) or rejects (returning funds up the tree).
5. Each manager calls `claim` to pull their approved USDC out.

## What V1 is — and isn't

V1 is deployed on both Arc Mainnet (chain id 5042) and Arc Testnet (chain id 5042002). It is:

- A working, auditable smart contract with 112 automated tests.
- A web application for creating, managing and settling commitments.
- A single-contract system with no off-chain components affecting fund custody.

V1 is **not**:

- An SDK, agent runtime, or AI evaluator.
- A system with multi-sig, dispute resolution, or partial release.
- Audited by an external security firm.

## Related

- [Quick start](/docs/quick-start) — create your first objective
- [Objectives and commitments](/docs/objectives-and-commitments) — tree rules in detail
- [Security](/security) — known limitations and audit status
