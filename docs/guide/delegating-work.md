# Delegating work

Delegation lets a manager split their commitment's budget across specialist sub-managers. Each specialist gets their own commitment, with their own deadline and accountability.

## Who can delegate

Only the **manager** of an Active commitment can create children. If you are not the manager, the Delegate button is not shown.

## No token transfer

Creating a child does **not** trigger a USDC transfer. The amount is moved from the parent's `remaining` balance to the child's `remaining` balance by internal accounting. USDC only leaves the contract when a manager calls `claim` after an approval.

## Creating a child commitment

Open the commitment you manage, click **Delegate work**, and fill in:

| Field | Description |
|-------|-------------|
| **Manager** | The specialist's wallet address. Must not be the zero address. |
| **Amount** | USDC to allocate to this child. Must be > 0 and fit within available budget. |
| **Deadline** | Must be ≤ the parent's deadline. |
| **Title** | Stored onchain and public. |

For direct children of a root, the contract enforces the delegation limit. If `allocated + amount > delegationLimit`, the transaction reverts with `DelegationCapacityExceeded`.

## Depth and child limits

| Constraint | Limit |
|-----------|-------|
| Max depth | 8 (root = 0) |
| Max children per commitment | 16 |

Attempting to exceed either limit reverts the transaction.

## After delegation

The child appears in the tree immediately after the `ChildCreated` event is indexed. The child starts in the **Active** state. The specialist can now submit their work or create further children.

## Freeing capacity

If a child fails (rejected, cancelled, or expired), its unspent remaining returns to the parent, and the root's `allocated` decreases. This frees capacity for a new child up to the returned amount.

## Related

- [Delegation and reserve](/docs/delegation-and-reserve) — limits and the protected reserve
- [Objectives and commitments](/docs/objectives-and-commitments) — depth and child count rules
- [Submitting and reviewing](/docs/submitting-and-reviewing) — next step after delegation
