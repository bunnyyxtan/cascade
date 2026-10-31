# Troubleshooting

## Wrong network

The app checks your wallet's chain ID on connection. If your wallet is on the wrong network, the app shows a "Wrong network" banner and disables all write operations.

**Fix:** switch your wallet to Arc Testnet (chain id 5042002, RPC `https://rpc.testnet.arc.io`). The app may prompt you to switch automatically.

## "Verifying contract…" or "Couldn't verify"

On startup the app fetches the deployed bytecode and computes its keccak256. If the result does not match the expected codehash, all writes are gated until the check passes or the page is refreshed.

- **"Verifying contract…"** — the check is still running (usually under 2 seconds). Wait for it to complete.
- **"Couldn't verify"** — the check failed. This can mean: an RPC error, a network timeout, or (rarely) a genuine mismatch. Refresh the page. If it persists, the contract address or codehash in the app's configuration may be incorrect. See [Verifying Cascade](/docs/verifying-cascade).

## Rejected in wallet vs transaction failed

- **User rejection** (you clicked Cancel / Reject in your wallet) — the app shows a neutral note, no error. Nothing happened onchain.
- **Transaction reverted** — the contract rejected the transaction. The app shows a red error with the revert reason where available. Common reasons: wrong state (e.g. calling `approve` on a non-Submitted commitment), permissions (e.g. calling `cancel` when you are not the approver), or constraint violations (e.g. `DelegationCapacityExceeded`).

## Missing history while syncing

After connection, the app fetches commitment events from the deploy block (69,056,151) forward. On first load this can take a few seconds. The Activity tab shows a progress indicator. If a commitment you expect to see is missing, wait for the sync to complete before investigating further.

## Allowance issues

If the approve step fails or was rejected, a leftover non-zero allowance can prevent a subsequent approve from succeeding (some ERC-20 implementations require resetting to zero before increasing). The app detects this and sends a zero-reset approve before the budget approve. If you see two approval transactions, that is why.

## Balance appears as two numbers

On Arc Testnet, USDC is both the ERC-20 token and the native gas token. Your wallet may show a "USDC" ERC-20 balance (6 decimals) and a native "USDC" balance (18 decimals). These are the **same pool of money** exposed two ways. The Cascade app always uses the ERC-20 view (6 decimals). Do not add them together — that would double-count.

## Still stuck?

Contact [bunnyyxtan@gmail.com](mailto:bunnyyxtan@gmail.com) or open a [GitHub issue](https://github.com/bunnyyxtan/cascade/issues). Include:

- The transaction hash from the block explorer.
- The commitment ID (from the URL or the tree).
- The error message shown in the app.

## Related

- [Verifying Cascade](/docs/verifying-cascade) — reproduce the codehash check manually
- [Support](/support) — contact and GitHub
- [Networks and addresses](/docs/networks-and-addresses) — RPC and chain configuration
