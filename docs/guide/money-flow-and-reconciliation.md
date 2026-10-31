# Money flow and reconciliation

## Three balances

At any point, the USDC held by the Cascade contract exists in one of three states:

| Balance | Meaning |
|---------|---------|
| **Escrowed** | Held in active commitments (`remaining` field). Not yet owed to anyone. |
| **Claimable** | Approved and owed to a specific address, but not yet withdrawn. |
| **Withdrawn** | Already transferred out via `claim`. No longer in the contract. |

The contract maintains two invariants:

```
totalEscrowed  == Σ commitment[i].remaining   (for all commitments)
totalClaimable == Σ claimable[address]         (for all addresses)
contract USDC balance >= totalEscrowed + totalClaimable
```

The third invariant (`>=` not `==`) allows for unsolicited ERC-20 transfers, but those funds are permanently unrecoverable — there is no sweep function.

## What happens on each outcome

### Approve

The approver calls `approve(id)`. The commitment's full `remaining` balance moves to `claimable[manager]`. No USDC leaves the contract yet. The manager must later call `claim` to pull it out.

- For a **root**: the client's protected reserve (`remaining` after all children resolved) also becomes available; it was never delegated, so it is returned to the root's client via the root's own resolution.
- For a **child**: the unspent portion returns to the parent's `remaining`. Any amount the child itself delegated to its own children has already been settled (leaves first).

### Reject

The approver calls `reject(id)`. The commitment's `remaining` returns to the **parent's** `remaining`. For a root, the remaining goes to the **client's** claimable balance.

### Cancel

The approver calls `cancel(id)` while the commitment is Active (not Submitted). The same return path as reject applies.

### Expire

Anyone calls `expire(id)` after the deadline. The same return path applies.

> Already-settled descendant payouts are never clawed back. If Child B was approved before the root was cancelled, the manager of Child B keeps their USDC.

## Worked example

Using testnet objectives #1 / #2 / #3 from the initial end-to-end runs:

| Event | Amount | Where funds go |
|-------|--------|---------------|
| Root created | 2.00 USDC escrowed | Contract |
| Child #2 created | 0.30 delegated | Child #2 escrowed (internal) |
| Child #2 approved | 0.30 released | Specialist's claimable |
| Child #3 created | 0.20 delegated | Child #3 escrowed |
| Child #3 rejected | 0.20 returned | Back to root's remaining |
| Child #4 created | 0.70 delegated | Child #4 escrowed |
| Child #4 cancelled | 0.70 returned | Back to root's remaining |
| Root approved | 1.70 released | Root manager's claimable |

Total released to claimable: 0.30 (specialist) + 1.70 (root manager) = 2.00 USDC. Zero remains escrowed.

## How the Funds block in the app reconciles

The app's Funds card shows three lines that correspond exactly to the three balances above:

- **Held** = `totalEscrowed` (contract read)
- **Claimable** = your `claimable[address]` balance (contract read)
- **Claimed** = derived from `Claimed` events in history

The sum of all three equals the total USDC ever deposited, since no funds disappear and settled descendants are never reversed.

## Related

- [Claiming USDC](/docs/claiming-usdc) — how to pull out your claimable balance
- [States and permissions](/docs/states-and-permissions) — full permission table
- [Delegation and reserve](/docs/delegation-and-reserve) — the protected reserve
