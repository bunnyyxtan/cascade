# Creating an objective

An objective is the top-level commitment you fund. It costs one ERC-20 approval transaction and one contract write.

## Before you begin

- Your wallet must be connected and on the correct Arc network (Mainnet: chain id 5042; Testnet: chain id 5042002).
- You need enough USDC for the budget amount plus a small amount for gas. On Arc, USDC covers both.
- The app must show "Contract verified" in the status bar. If it shows "Verifying…" or "Couldn't verify", do not proceed — see [Troubleshooting](/docs/troubleshooting).

## Fields

| Field | Description |
|-------|-------------|
| **Title** | A short description of the outcome (stored onchain and public). |
| **Budget** | Total USDC to escrow. Must be greater than zero. |
| **Delegation limit** | Maximum the manager may allocate to direct children. Must be ≤ budget. May be zero or equal to budget. |
| **Deadline** | Unix timestamp of the deadline. Must be in the future. |
| **Manager** | The wallet address responsible for the work. Can be your own address. |

## The two-transaction flow

### 1. Approve

The app asks your wallet to sign an ERC-20 `approve` call, authorising the Cascade contract to spend exactly the budget amount. The approval is for the exact amount — not unlimited. If you have a pre-existing allowance from a previous failed attempt, the app sets it to zero first.

### 2. Create

Once the approval is confirmed, the app calls `createRoot`. This transfers the USDC from your wallet into contract escrow and emits a `RootCreated` event. The transaction includes all the fields above as calldata; the title and deadline are stored permanently onchain.

## After creation

The commitment appears in your tree immediately after the `RootCreated` event is indexed. The escrow summary on the page shows:

- **Budget** — the total you locked in.
- **Reserved** — the protected portion (budget − delegationLimit) that stays with you.
- **Delegatable** — the maximum you can delegate to direct children.

## Related

- [Delegation and reserve](/docs/delegation-and-reserve) — understanding the delegation limit
- [Delegating work](/docs/delegating-work) — allocating budget to a child
- [Quick start](/docs/quick-start) — end-to-end walkthrough
