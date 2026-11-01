# Security model

## What Cascade is

Cascade is an immutable, non-upgradeable, single-contract USDC escrow and delegation protocol. It has no admin keys, no proxy, no protocol fees, no governance, and no off-chain components that affect fund custody.

All money movements are onchain, pull-based, and explicitly authorised by the roles defined at commitment creation time.

---

## Trust model

### Roles

| Role | Capabilities | Trust requirement |
|------|-------------|-------------------|
| **Client** | Creates root commitment; is the approver of the root | Must trust the manager they appoint |
| **Manager** | Creates children; submits delivery | Must trust the approver to act honestly |
| **Approver** | Approves, rejects, cancels | Must act on the actual delivery outcome |

Role assignments are set at commitment creation and cannot be changed.

### Who controls funds

- USDC is held by the contract, not by any privileged address.
- A manager can only receive USDC by having a commitment approved.
- An approver can only move USDC by approving or failing a commitment (funds go to the manager or return to the parent; neither path benefits the approver directly).
- The client retains the protected reserve (budget minus delegationLimit) until the root resolves.

### What the contract cannot do

- There is no admin function that can drain the contract.
- There is no function that can modify a commitment's roles, budget, or deadline after creation.
- Native ETH/Arc gas tokens are rejected (`NativeNotAccepted`).

---

## Known limitations and risks

### Role honesty

The protocol enforces **structural constraints** but not **outcome honesty**. Specifically:

- An approver who is colluding with the manager can approve fabricated work.
- A manager can submit an empty or false `deliveryRef` string.
- The `deliveryRef` field is not validated onchain. It is a human-readable string for off-chain reference only.

Cascade is designed for contexts where participants have an off-chain trust relationship, legal agreement, or reputational stake. It is not designed as a trustless escrow between adversarial strangers.

### Deadline expiry is not automatic

Expired commitments do not self-resolve. Anyone may call `expire` once `block.timestamp > deadline` and all children are terminal. If no one calls `expire`, funds remain in escrow indefinitely. Frontends should prompt eligible expiry actions.

### Children must be terminal before parent can approve

An approver cannot approve a commitment that has active children. This protects against double-counting but means the approval flow must proceed leaf-first.

### Re-entrancy

All state-changing functions use OpenZeppelin's `ReentrancyGuard`. USDC is transferred via `SafeERC20.safeTransferFrom` / `safeTransfer`, which are ERC-20 standard and do not involve callbacks.

Arc's USDC at `0x3600000000000000000000000000000000000000` does not implement ERC-777 hooks. The risk of re-entrancy through the token callback path is not present on Arc.

### Integer overflow

The contract targets Solidity 0.8.28, which has built-in overflow protection. All arithmetic is in 256-bit unsigned integers. USDC is 6 decimals; the maximum sensible amount is well within uint256 range.

### No oracle, no price feed

The contract operates exclusively in USDC. There are no price feeds, no external contract calls (other than the USDC ERC-20), and no oracle dependencies.

### Unsolicited token transfers

The balance invariant uses `>=` not `==`. Unsolicited ERC-20 transfers into the contract do not inflate `totalEscrowed` or `totalClaimable`. They are not recoverable (there is no sweep function). Sending unsolicited USDC to this contract loses those funds permanently.

---

## Frontend security

### Config verification

The frontend refuses to submit write transactions until it has verified:

1. The RPC returns the expected chain ID.
2. `keccak256(eth_getCode(address))` matches `VITE_CASCADE_CODEHASH`.
3. `Cascade.usdc()` returns the expected USDC address.

This protects users against a misconfigured or substituted contract address.

### No secret handling

The frontend holds no private keys and no secrets. All signing is delegated to the user's browser wallet via EIP-1193.

### Arc Studio instrumentation

`src/tracing.ts` and `src/console-capture.ts` are loaded only when the app detects it is running inside an `studio.arc.io` parent frame (checked via `ancestorOrigins` and `document.referrer`). They are not loaded in production deployments. They record RPC calls and console output for developer debugging only; no private keys or seed phrases pass through these paths.

---

## Out of scope

The following are explicitly out of scope for V1:

- Multi-sig approvals
- Dispute resolution or arbitration
- Time-locked fund release
- Automatic expiry
- Fee collection
- Cross-chain operations

---

## Vulnerability reporting

See [SECURITY.md](../SECURITY.md) for responsible disclosure instructions.

---

## Audit status

Cascade V1 has not undergone a professional security audit. It is deployed on both Arc Testnet (evaluation) and Arc Mainnet (real USDC). **No independent security audit has been completed. Use amounts proportionate to the risk of an unaudited contract.**
