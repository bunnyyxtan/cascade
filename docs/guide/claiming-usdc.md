# Claiming USDC

USDC in Cascade is released **pull-based**: after an approval, the funds are credited to the manager's claimable balance inside the contract. They stay there until the manager calls `claim`.

## Who can claim

Any address with a positive `claimable` balance can call `claim`. This includes:

- Managers whose commitments have been approved.
- Clients whose root commitment's reserve was released (on approval, rejection, cancellation, or expiry of the root).

## How to claim

1. Connect your wallet.
2. Go to the **Claimable** tab or the Funds section of your profile.
3. The app shows your current claimable USDC balance (read from `claimable[address]` on the contract).
4. Click **Claim**. Your wallet signs one transaction: `claim()`.
5. The contract transfers your entire claimable balance to your wallet in a single USDC transfer.

There is no partial claim. `claim` always transfers the full claimable balance.

## The receipt

After the transaction confirms, the app decodes the `Claimed(account, amount)` event from the receipt and displays:

- The amount claimed.
- The transaction hash (links to the block explorer).

The event is also indexed in your activity history.

## Claimable balance after a root failure

If a root is rejected, cancelled, or expired, the client's `remaining` (including the protected reserve) is returned to the **client's claimable balance**. The client then claims it the same way a manager would.

## Related

- [Money flow and reconciliation](/docs/money-flow-and-reconciliation): the three balances and invariants
- [Submitting and reviewing](/docs/submitting-and-reviewing): approval triggers the claimable credit
- [Troubleshooting](/docs/troubleshooting): if your claimable balance looks wrong
