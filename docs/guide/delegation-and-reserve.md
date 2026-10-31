# Delegation and reserve

## The delegation limit

When a client creates a root, they set a **delegation limit** — the maximum amount that the root manager may allocate to direct child commitments in total.

The delegation limit must be less than or equal to the budget. It can be set to `0` (no delegation allowed) or equal to the budget (full delegation allowed).

## The protected reserve

The difference between the budget and the delegation limit is the **protected reserve**:

```
reserve = budget − delegationLimit
```

The reserve stays at the root and is never exposed to delegation. It is released to the client's claimable balance only when the root itself resolves (whether approved, rejected, cancelled, or expired).

> **Important:** delegation is internal accounting, not a USDC transfer. When a manager creates a child, no tokens move between wallets. The amount is subtracted from the parent's remaining balance and attributed to the child. USDC only leaves the contract when a manager calls `claim` after an approval.

## Worked example

Suppose Alice creates a root with:

- Budget: 10 USDC
- Delegation limit: 7 USDC
- Reserve: 3 USDC (non-delegatable, stays escrowed in the contract at the root until it resolves)

Bob (manager) can now delegate up to 7 USDC across direct children. He creates:

1. Child A: 4 USDC (allocated: 4)
2. Child B: 3 USDC (allocated: 4 + 3 = 7)

At this point the delegation limit is fully used. A third child requesting even 1 USDC would be refused with `DelegationCapacityExceeded`.

## Freed capacity

When a direct root child fails (is rejected, cancelled, or expired), its unspent remaining is returned to the parent, and the root's `allocated` counter decreases by the same amount. This frees up delegation capacity for a new child.

For example, if Child A fails and returns all 4 USDC, Bob can now create a new child of up to 4 USDC.

A child that was partially approved and then cancelled returns only the unspent portion, freeing only that amount of capacity.

## The root-only rule

The delegation limit and the allocation guard (`allocated + amount ≤ delegationLimit`) apply only to **direct children of a root** (depth 1). Children at deeper levels are bounded only by their parent's remaining budget and the MAX_DEPTH / MAX_CHILDREN constraints.

## Related

- [Objectives and commitments](/docs/objectives-and-commitments) — tree structure and depth limits
- [Creating an objective](/docs/creating-an-objective) — setting the budget and delegation limit
- [States and permissions](/docs/states-and-permissions) — when delegation capacity can be reused
