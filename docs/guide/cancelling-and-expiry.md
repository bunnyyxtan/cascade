# Cancelling and expiry

Commitments can end without approval in two ways: **cancellation** (approver-initiated) and **expiry** (permissionless, after the deadline).

## Cancellation

The approver can cancel an Active commitment at any time, provided all direct children are terminal.

- Who: the commitment's **approver**.
- State: **Active** (not Submitted — use reject for a Submitted commitment).
- Condition: all direct children must be terminal.
- Result: the commitment moves to Failed(Cancelled). The remaining balance returns to the parent's remaining (or to the client's claimable if this is a root).

To cancel a commitment that has active children, cancel or expire the children first, working leaf-first up the tree.

## Expiry

After the deadline passes, any address (including bots) can call `expire(id)` on an Active commitment whose direct children are all terminal.

- Who: **anyone**.
- State: **Active**.
- Condition: `block.timestamp > deadline` AND all direct children terminal.
- Result: Failed(Expired). Same fund return path as cancellation.

**Expiry is not automatic.** The contract does not self-resolve expired commitments. The Cascade app shows an "Expire" action when a commitment is eligible. If no one calls `expire`, the funds remain in escrow indefinitely.

## Bottom-up ordering

Both cancellation and expiry require all direct children to be terminal first. This means you must work **from the leaves up**:

1. Expire or cancel the deepest children first.
2. Work up towards the root.
3. Cancel or expire the root last.

## What happens to funds

When a commitment fails (by any reason):

- A **child's** remaining returns to its parent's `remaining`, where it can be re-delegated or remain reserved.
- A **root's** remaining goes to the **client's** claimable balance.

Already-settled descendants are not affected — an approved child's manager keeps their USDC even if the root later fails.

## Related

- [States and permissions](/docs/states-and-permissions) — full permission table
- [Money flow and reconciliation](/docs/money-flow-and-reconciliation) — what happens to funds on failure
- [Claiming USDC](/docs/claiming-usdc) — withdrawing after a root failure
