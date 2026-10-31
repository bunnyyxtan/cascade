# Quick start

This guide walks you through creating an objective, delegating work, submitting and approving a delivery, and withdrawing your USDC — all on Arc Testnet.

## Prerequisites

1. **A browser-extension wallet** — MetaMask or any EIP-1193-compatible extension.
2. **Arc Testnet configured** — chain id `5042002`, RPC `https://rpc.testnet.arc.io`. Your wallet may auto-detect this when you connect.
3. **Test USDC** — on Arc Testnet, USDC is also the native gas token, so one balance covers both gas and funding. Get test USDC from the [Circle Testnet Faucet](https://faucet.circle.com) or the "Get test USDC" button in the Arc Studio sidebar (if you are using Arc Studio).

## Step 1 — Connect your wallet

Click **Connect Wallet** in the top-right corner. Select your extension wallet and accept the connection request. The app checks that you are on Arc Testnet (chain id 5042002) and that the deployed contract bytecode matches the expected codehash before enabling any write operations.

## Step 2 — Create an objective (root)

Click **New objective** on the home screen. Fill in:

- **Title** — a short description of the outcome.
- **Budget** — the total USDC you want to escrow (e.g. `10`).
- **Delegation limit** — the maximum you allow the manager to delegate further (e.g. `7`). The remaining `3` USDC is your protected reserve and stays with you until the root resolves. You can set the limit to `0` if you don't want any delegation, or equal to the budget if you allow full delegation.
- **Deadline** — the date after which anyone may expire the commitment if work is unfinished.
- **Manager address** — the wallet that will do the work (can be your own).

Click **Review**, then **Confirm**. Your wallet will ask you to sign **two** transactions:

1. **Approve** — authorises the exact budget amount as an ERC-20 allowance for the Cascade contract.
2. **Create** — executes `createRoot`, pulling the USDC into escrow.

After the second transaction confirms, the objective appears in your tree.

## Step 3 — Delegate work

As the manager, open the objective and click **Delegate work**. Fill in the child commitment's manager, amount, deadline and title. No USDC transfer happens — the amount is moved from the parent's remaining balance by internal accounting.

Repeat for each specialist. Each child's deadline must be on or before the parent's deadline, and the total allocated to direct children cannot exceed the delegation limit you set in Step 2.

## Step 4 — Submit delivery

As the manager, once all direct children are terminal (approved, rejected, cancelled or expired), click **Submit delivery**. Paste a delivery reference — a URL, IPFS CID, or any string that identifies your work. This string is stored permanently onchain and is public.

Your wallet signs one transaction (`submit`).

## Step 5 — Approve (or reject)

As the approver, open the submitted commitment and click **Approve** or **Reject**.

- **Approve** — releases the full remaining balance to the manager's claimable USDC.
- **Reject** — returns the remaining balance to the parent commitment (or to the client if this is the root).

Your wallet signs one transaction.

## Step 6 — Withdraw USDC

As the manager, after approval, go to your **Claimable** page. Click **Claim**. Your wallet signs one transaction (`claim`) and the USDC transfers to your wallet.

## Related

- [Objectives and commitments](/docs/objectives-and-commitments) — depth and child limits
- [Delegation and reserve](/docs/delegation-and-reserve) — how limits and reserves work
- [Money flow and reconciliation](/docs/money-flow-and-reconciliation) — where funds go on each outcome
- [Troubleshooting](/docs/troubleshooting) — common issues
