# Submitting and reviewing

## Submitting a delivery

Once a manager has completed their work (and all of their direct children are in a terminal state), they can submit a delivery reference to move the commitment from Active to Submitted.

### Requirements

- You must be the **manager** of the commitment.
- The commitment must be **Active**.
- The deadline must **not yet have passed** (if it has, `expire` is the only option).
- All **direct children** must be terminal (Succeeded or Failed).

### The delivery reference

The `deliveryRef` field is a public string stored permanently onchain. It should point to the work you are delivering. Good choices:

- An IPFS CID (e.g. `ipfs://bafybeig...`): content-addressed, permanent, and verifiable.
- A URL to a hosted document, report, or codebase.
- Any reference that the approver can use to verify the outcome.

The string is not validated onchain. It is human-readable evidence for the approver.

### Signing

Your wallet signs one transaction: `submit(id, deliveryRef)`. After confirmation, the commitment state changes to **Submitted** and the `DeliverySubmitted` event is emitted.

## Reviewing a delivery

Once a commitment is Submitted, the **approver** (the parent's manager, or the client for a root) can take action.

### Approve

Click **Approve**. Your wallet signs `approve(id)`. The commitment's full `remaining` balance moves to the manager's claimable USDC. The state moves to Succeeded.

### Reject

Click **Reject**. Your wallet signs `reject(id)`. The remaining balance returns to the parent commitment (or to the client's claimable balance if this is a root). The state moves to Failed(Rejected).

There is no partial release. The whole `remaining` is either released to the manager's claimable balance (approve) or returned to the parent's remaining (reject). For a root, rejection returns the remaining directly to the client's claimable balance rather than a parent.

## Related

- [Money flow and reconciliation](/docs/money-flow-and-reconciliation): where funds go on approve and reject
- [Claiming USDC](/docs/claiming-usdc): how to withdraw after approval
- [States and permissions](/docs/states-and-permissions): full permission table
