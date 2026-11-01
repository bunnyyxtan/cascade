# Limitations

Cascade V1 is designed to be small, auditable, and immutable. That means some capabilities that a more complex system might offer are intentionally absent.

## No owner, pause, or upgrade

There is no admin key, no pause function, and no upgrade path. Once deployed, the contract cannot be modified or stopped by anyone, including the original developer.

This is a feature: it means no one can drain funds or alter the rules. It is also a limitation: bugs cannot be patched without deploying a new contract and migrating users.

## No external audit

No external security audit has been completed for V1. The contract has 112 automated tests (60 unit, 10 fuzz, 6 invariant, 26 adversarial, 10 deployment-verification) but this does not guarantee the absence of vulnerabilities. See [Security](/security) for current status.

## No partial release

When a commitment is approved, the approver releases the **full remaining balance** to the manager. There is no way to approve a portion and withhold the rest.

## Roles cannot be reassigned

Managers and approvers are set at commitment creation and cannot be changed. If you appoint the wrong manager or approver, the commitment must be cancelled and recreated.

## Expiry is not automatic

Expired commitments do not self-resolve. After the deadline passes and all children are terminal, someone must call `expire` explicitly. If no one does, the funds remain in escrow indefinitely.

## RPC log range limits

The app fetches historical events from the deploy block forward. Public RPC endpoints may have range limits on `eth_getLogs`. If the app takes a long time to sync or shows a stale history, this is likely the cause. The app retries automatically with smaller ranges, but on a slow connection the initial sync may take a minute or more.

## Testnet vs mainnet

V1 is deployed on both Arc Mainnet (chain id 5042) and Arc Testnet (chain id 5042002). USDC on Arc Mainnet has real monetary value. Test USDC on Arc Testnet has no monetary value. See [Networks and addresses](/docs/networks-and-addresses) for contract addresses and RPC details.

## Out of scope for V1

The following are not implemented and will not be added without a new contract:

- Multi-sig approvals
- Dispute resolution or arbitration
- Automatic expiry
- Staged or partial fund release
- Fee collection
- Cross-chain operations
- Governance or upgrades

## Related

- [Security](/security): responsible disclosure and audit status
- [Usage & Risks](/usage-risks): risk disclosure and no-warranty statement
- [Verifying Cascade](/docs/verifying-cascade): confirming the deployed bytecode
