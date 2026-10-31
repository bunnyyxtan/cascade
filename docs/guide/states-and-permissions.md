# States and permissions

## State machine

Each commitment moves through states in one direction:

```
Active
  │
  ├── submit (manager, before deadline, all children terminal)
  │         ↓
  │     Submitted
  │         │
  │         ├── approve (approver) → Succeeded  [terminal]
  │         └── reject  (approver) → Failed/Rejected  [terminal]
  │
  ├── cancel (approver, all children terminal) → Failed/Cancelled  [terminal]
  │
  └── expire  (anyone, after deadline, all children terminal) → Failed/Expired  [terminal]
```

Terminal states (Succeeded, Failed) are final and irreversible.

## Permission table

| Action | Who may call it | Required state | Additional conditions |
|--------|----------------|---------------|-----------------------|
| `createRoot` | Anyone | — | Needs prior ERC-20 approval for the budget amount |
| `createChild` | Parent's manager | Parent: Active | All tree limits satisfied; delegation capacity available (root children) |
| `submit` | Commitment's manager | Active | Before the deadline; all direct children terminal |
| `approve` | Commitment's approver | Submitted | All direct children terminal |
| `reject` | Commitment's approver | Submitted | — |
| `cancel` | Commitment's approver | Active | All direct children terminal |
| `expire` | Anyone | Active | After the deadline; all direct children terminal |
| `claim` | Anyone | — | Caller must have a positive claimable balance |

## "All direct children terminal" condition

For `submit`, `approve`, `cancel`, and `expire`, all **direct** children of the commitment must be in a terminal state (Succeeded or Failed). Grandchildren are not checked directly — they must be settled before their parent can be settled.

This means approval flows proceed **leaf-first**: the deepest commitments must resolve before their parents.

## Who is the approver?

- For a **root**: the approver is the client (the address that called `createRoot`).
- For a **child**: the approver is the parent's manager at the time the child was created.

Role assignments are immutable — they cannot be changed after creation.

## Related

- [Objectives and commitments](/docs/objectives-and-commitments) — tree structure
- [Cancelling and expiry](/docs/cancelling-and-expiry) — permissionless expiry in detail
- [Submitting and reviewing](/docs/submitting-and-reviewing) — the submit and approve flow
