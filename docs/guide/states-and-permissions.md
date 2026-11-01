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
  │         ├── reject  (approver) → Failed/Rejected  [terminal]
  │         └── expire  (anyone, after deadline, all children terminal) → Failed/Expired  [terminal]
  │
  ├── cancel (approver, all children terminal) → Failed/Cancelled  [terminal]
  │
  └── expire  (anyone, after deadline, all children terminal) → Failed/Expired  [terminal]
```

Terminal states (Succeeded, Failed) are final and irreversible.

## Permission table

| Action | Who may call it | Required state | Additional conditions |
|--------|----------------|---------------|-----------------------|
| `createRoot` | Anyone | (any) | Needs prior ERC-20 approval for the budget amount |
| `createChild` | Parent's manager | Parent: Active | All tree limits satisfied; delegation capacity available (root children) |
| `submit` | Commitment's manager | Active | Before the deadline; all direct children terminal |
| `approve` | Commitment's approver | Submitted | (none — children were verified at submit time) |
| `reject` | Commitment's approver | Submitted | (none) |
| `cancel` | Commitment's approver | Active | All direct children terminal |
| `expire` | Anyone | Active or Submitted | After the deadline; all direct children terminal |
| `claim` | Anyone | (any) | Caller must have a positive claimable balance |

## "All direct children terminal" condition

For `submit`, `cancel`, and `expire`, all **direct** children of the commitment must be in a terminal state (Succeeded or Failed). Grandchildren are not checked directly; they must be settled before their parent can be settled.

`approve` does not re-check children at approval time because `submit` already verified them. Direct children are guaranteed terminal by the time approval happens.

This means approval flows proceed **leaf-first**: the deepest commitments must resolve before their parents.

## Who is the approver?

- For a **root**: the approver is the client (the address that called `createRoot`).
- For a **child**: the approver is the parent's manager at the time the child was created.

Role assignments are immutable and cannot be changed after creation.

## Related

- [Objectives and commitments](/docs/objectives-and-commitments): tree structure
- [Cancelling and expiry](/docs/cancelling-and-expiry): permissionless expiry in detail
- [Submitting and reviewing](/docs/submitting-and-reviewing): the submit and approve flow
