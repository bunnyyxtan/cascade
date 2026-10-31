# Objectives and commitments

Every funded unit of work in Cascade is a **commitment**. A commitment at the top of a tree (no parent) is called a **root**; everything beneath it is a **child**. The Cascade app uses "objective" as the display name for a root commitment.

## Roots and children

A **root commitment** is created by a client who transfers USDC into escrow. The client becomes the root's approver. The client appoints a manager, who is responsible for delivering the work.

A **child commitment** is created by the parent's manager, allocating a portion of the parent's remaining budget. No additional USDC transfer occurs — funds move by internal accounting only. The child's approver is inherited from the parent's manager (the person who created it).

## Tree limits

| Constraint | Value |
|-----------|-------|
| Maximum depth | 8 (root = depth 0, max child = depth 7) |
| Maximum direct children | 16 per commitment |

These limits are enforced onchain and cannot be overridden.

## Deadline rules

Every commitment has a deadline (a Unix timestamp). The deadline is set at creation and cannot be changed.

- A child's deadline must be **on or before** the parent's deadline.
- After the deadline passes and all direct children are terminal, anyone may call `expire` to move the commitment to a Failed(Expired) state.

## States

Each commitment moves through the following states:

| State | Meaning |
|-------|---------|
| **Active** | Open — manager may create children or submit delivery |
| **Submitted** | Delivery reference recorded, awaiting approver action |
| **Succeeded** | Terminal — approver approved, USDC credited to manager |
| **Failed** | Terminal — rejected, cancelled, or expired |

Terminal states are final. No commitment can move backwards.

## Worked example

Alice (client) creates a root with a 10 USDC budget, a 7 USDC delegation limit, and Bob as manager. Bob delegates 4 USDC to Carol and 3 USDC to Dan, each as child commitments. The remaining 3 USDC is Alice's protected reserve, which cannot be delegated.

- Carol and Dan each complete their work, and Bob approves them.
- Bob then submits the root.
- Alice approves, releasing Bob's remaining balance.
- Alice's reserve (3 USDC) is also released to her claimable balance.

## Related

- [Delegation and reserve](/docs/delegation-and-reserve) — how the delegation limit and reserve work
- [States and permissions](/docs/states-and-permissions) — the full state machine and permission table
- [Money flow and reconciliation](/docs/money-flow-and-reconciliation) — where USDC goes on each outcome
