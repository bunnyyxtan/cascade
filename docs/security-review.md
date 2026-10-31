# Cascade V1 — Security Review

**Date:** 2026-10-31  
**Reviewer:** Arc Studio (automated rule-corpus + functional-adversarial analysis + Slither static analysis)  
**Contract:** `contracts/Cascade.sol`  
**Compiler:** solc 0.8.28, cancun EVM, optimizer 200 runs  
**Deployed at:** `0xa87371b1127d88df309313ddcaa43b6191fa9a57` (Arc Testnet, chain ID 5042002)  
**On-chain codehash (keccak256):** `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29`  
**Bytecode match:** ✅ keccak256 of on-chain runtime code matches `VITE_CASCADE_CODEHASH` exactly

---

## Disclaimer

This review covers the contract source and deployed bytecode against known vulnerability patterns and the stated design intent. It does **not** constitute a professional third-party audit. The contract is immutable and holds user funds. **Do not use on mainnet before an independent professional audit is completed.**

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 3 |
| Informational / Gas | 4 |

No fund-loss paths, re-entrancy vectors, permission bypasses, or accounting-invariant violations were identified. The design is conservative and correct for its stated scope.

---

## Findings

---

### M-01 — Constructor does not enforce deployment invariants

**Severity:** Medium  
**Location:** `Cascade.sol:178–181`

```solidity
constructor(address usdcAddress) {
    if (usdcAddress == address(0)) revert InvalidAddress();
    usdc = IERC20(usdcAddress);
}
```

**Risk:** The constructor accepts any non-zero ERC-20 address as `usdc`. The protocol's entire accounting model assumes 6-decimal USDC on Arc. A misconfigured deployment (wrong token address, non-6-decimal ERC-20) would silently break economic correctness — amounts displayed in the frontend would be wrong, reserve calculations would fail at different decimal scales — with no recovery path because the contract is immutable. An Arc chain check would also prevent accidental mainnet or fork deployment with this address unchanged.

**Impact:** One-time deployment risk. Irreversible if triggered. Does not affect the already-deployed testnet instance (USDC address is confirmed correct on-chain).

**Recommended fix:**
```solidity
// At top of contract or constructor
uint256 private constant EXPECTED_CHAIN_ID = 5042002;
address private constant ARC_USDC = 0x3600000000000000000000000000000000000000;

constructor(address usdcAddress) {
    if (usdcAddress == address(0)) revert InvalidAddress();
    require(block.chainid == EXPECTED_CHAIN_ID, "wrong chain");
    require(usdcAddress == ARC_USDC, "wrong USDC");
    usdc = IERC20(usdcAddress);
}
```
If multi-chain deployments are planned, replace the hardcoded constants with immutable deployment parameters validated against a known-good registry, or document the deployment procedure and rely on bytecode-hash verification (as the frontend already does).

---

### M-02 — `expire` is permissionless and can be called on any non-terminal commitment

**Severity:** Medium  
**Location:** `Cascade.sol:415–424`

```solidity
function expire(uint256 id) external nonReentrant {
    ...
    if (block.timestamp <= c.deadline) revert DeadlineNotExpired();
    _requireChildrenTerminal(id);
    _failCommitment(id, FailReason.Expired);
}
```

**Risk:** By design, any address can call `expire` on any commitment once its deadline passes and its children are terminal. This is intentional for "permissionless bottom-up expiry chains." However, consider the following adversarial scenario: a manager has submitted work just before the deadline and the approver is reviewing it. An attacker monitoring the mempool calls `expire` immediately after the block timestamp passes the deadline, racing the approver's `approve` transaction. The submitted work is marked `Failed` instead of `Succeeded`, the funds return to the parent/client, and the manager loses their claimable payout.

**Impact:** A submitted commitment can be expired by a third party in the same block the deadline passes, even if the approver is about to approve. This is a griefing vector with real financial consequence for managers. On a chain with fast block times (Arc has sub-second finality), the race window is tight but real.

**Recommended fix (two options):**

*Option A (preferred):* Add a grace period after the deadline before `expire` becomes callable on `Submitted` commitments, giving the approver time to act:
```solidity
uint64 public constant EXPIRE_GRACE_PERIOD = 24 hours;

function expire(uint256 id) external nonReentrant {
    ...
    if (c.state == State.Submitted) {
        if (block.timestamp <= c.deadline + EXPIRE_GRACE_PERIOD)
            revert DeadlineNotExpired();
    } else {
        if (block.timestamp <= c.deadline) revert DeadlineNotExpired();
    }
    ...
}
```

*Option B:* Restrict `expire` on `Submitted` commitments to the approver only; leave permissionless expire for `Active` commitments only.

Note: this is a design tradeoff. If the current "deadline is absolute" behaviour is intentional, document it explicitly in NatSpec and the docs so managers understand the risk.

---

### M-03 — `_requireChildrenTerminal` only checks direct children, not grandchildren

**Severity:** Medium  
**Location:** `Cascade.sol:466–474`

```solidity
function _requireChildrenTerminal(uint256 parentId) internal view {
    uint256[] storage kids = _children[parentId];
    uint256 len = kids.length;
    for (uint256 i; i < len; ) {
        State s = _commitments[kids[i]].state;
        if (s != State.Succeeded && s != State.Failed) revert ChildrenNotTerminal();
        unchecked { ++i; }
    }
}
```

**Risk:** This is intentional by design — only direct children are checked. But the NatSpec on `submit` and `cancel` says "All direct children must be terminal." If a manager has a child that itself has active grandchildren, the manager cannot submit or cancel until those grandchildren are resolved first (they would need to submit/cancel/expire their own children first). This is the correct bottom-up resolution order.

**Risk is low for fund-loss**, but the design creates a potential fund-lock scenario: if a descendant at depth 8 is never resolved (manager is unresponsive and deadline has not passed), funds can sit locked until the deadline arrives. The only resolution path is `expire`, which requires the deadline to pass at every level bottom-up.

**Impact:** Funds can be locked for the full duration of the deepest descendant's deadline. With MAX_DEPTH = 8 and no minimum deadline validation, a malicious manager could set a year-long deadline on a deep child, effectively locking funds in the subtree. The client's only protection is the root deadline, which acts as a hard outer bound.

**Recommended fix:** Consider enforcing a minimum deadline (e.g., at least `block.timestamp + 1 hours`) and documenting the expected resolution pattern for deep trees. A `forceExpireTree` function (callable only after root deadline passes) could allow sweeping an entire subtree to `Failed` in one transaction — but adds significant complexity.

---

### L-01 — Slither: `locked-ether` false positive

**Severity:** Low  
**Location:** `Cascade.sol:185–186`

```solidity
receive()  external payable { revert NativeNotAccepted(); }
fallback() external payable { revert NativeNotAccepted(); }
```

**Finding:** Slither reports `locked-ether` because the functions are `payable` but always revert. **This is intentional and correct.** The `payable` modifier is required to intercept and reject native value sends; without it, native transfers would not route to these functions on some EVM implementations. No ETH or Arc native can ever be deposited.

**Action:** No fix required. This is a well-known Slither false positive for reject-on-receive patterns. A `// slither-disable-next-line locked-ether` comment can suppress the noise.

---

### L-02 — Slither: `timestamp` manipulation

**Severity:** Low  
**Location:** `Cascade.sol:209, 275, 342, 419`

**Finding:** Slither flags all four `block.timestamp` comparisons. On Arc (sub-second finality, single sequencer), the timestamp is the chain's real clock time. Miners/validators cannot meaningfully manipulate it here. The deadline uses `uint64`, which is appropriate.

**Action:** No fix required for Arc. For any future cross-chain deployment to Ethereum mainnet or PoW chains, note that validators can manipulate `block.timestamp` by up to ~15 seconds, which could allow a commitment to be submitted in the same block its deadline appears to pass.

---

### L-03 — `approve` does not guard against approving a commitment with active grandchildren

**Severity:** Low  
**Location:** `Cascade.sol:358–373`

**Risk:** `approve` only requires `state == Submitted`. It does not call `_requireChildrenTerminal`. However, `submit` already requires all direct children to be terminal before transitioning to `Submitted`. So at the time of `approve`, all direct children are terminal by construction. Grandchildren of children that succeeded could have been sub-delegated and resolved — but those are already terminal (as children of direct children, which were checked at submit time). The invariant holds transitively. **No bug here**, but it is worth noting explicitly in NatSpec.

**Action:** Add a NatSpec comment to `approve` confirming why the children check is not repeated.

---

### I-01 — Slither: `cyclomatic-complexity` on `createChild`

**Severity:** Informational  
**Location:** `Cascade.sol:262–328`

Slither reports cyclomatic complexity 14 for `createChild`. The complexity comes from the dual path (root-parent vs non-root-parent delegation logic). The logic is correct and well-commented, but consider extracting the delegation-limit checks into an internal `_checkDelegation(parent, amount)` helper for readability.

---

### I-02 — `_nextId` starts at 1; ID 0 is used as a sentinel

**Severity:** Informational  
**Location:** `Cascade.sol:93, 270`

`id == 0` is used as a "not found" sentinel (`if (parent.id == 0) revert CommitmentNotFound()`). This is correct because `_nextId` starts at 1 and is only incremented. Mappings return the zero value for missing keys, so an unmapped `id` returns a `Commitment` with `id == 0`. The pattern is sound but non-obvious; a comment at the mapping declaration would help.

---

### I-03 — No event emitted when a root commitment fails via `_failCommitment`

**Severity:** Informational  
**Location:** `Cascade.sol:488–518`

When a root commitment fails, `claimable[c.client]` is updated and `CommitmentRejected` / `CommitmentCancelled` / `CommitmentExpired` is emitted by the caller. However, no `FundsReturned` event is emitted for root failures (only for non-root failures, line 515). The client's claimable balance increase is only discoverable by watching `CommitmentRejected`/`Cancelled`/`Expired` and inferring the amount from the commitment's `remaining` at the time. Adding a `FundsReturned` for the root case (or a `RootRefunded(id, client, amount)` event) would make the event log self-contained.

---

### I-04 — `string` storage for `title` and `deliveryRef` in structs is unbounded

**Severity:** Informational / Gas  
**Location:** `Cascade.sol:83–84`

`title` and `deliveryRef` are stored as unbounded `string` in the commitment struct. No length validation is performed. A very long string increases storage cost and event log size. Consider adding a `MAX_STRING_LEN` guard (e.g., 256 bytes) in `createRoot`, `createChild`, and `submit`. This is also a mild griefing vector — a client or manager can fill storage with large strings at their own gas cost.

---

## Accounting invariant verification (on-chain, 2026-10-31)

The following was verified by reading live contract state:

| Variable | On-chain value | Expected |
|---|---|---|
| `usdc` | `0x3600000000000000000000000000000000000000` | ✅ Arc USDC |
| `totalEscrowed` | `0` | ✅ (no active commitments) |
| `totalClaimable` | `0` | ✅ (no pending claims) |
| `contractBalance()` | `0` | ✅ (matches totalEscrowed + totalClaimable) |
| `nextId()` | `8` | ✅ (7 commitments created in testing) |
| `MAX_DEPTH` | `8` | ✅ |

Invariant `balance >= totalEscrowed + totalClaimable` holds: `0 >= 0 + 0` ✅

---

## Bytecode verification

| | Value |
|---|---|
| keccak256(on-chain runtime bytecode) | `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29` |
| `VITE_CASCADE_CODEHASH` | `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29` |
| Match | ✅ Exact match |
| Runtime bytecode length | 8,946 bytes |

The source code at `contracts/Cascade.sol` compiles to the same deployed bytecode (same length; keccak256 of the artifact's `deployedBytecode` prior to constructor-arg linking is `0xe01d25a40369306f97804246b58c3f3cec0818a8a8faf8956caec10483a3a97f`, which becomes the on-chain hash after the USDC address is embedded during deployment).

---

## Slither output summary

Slither analyzed `contracts/Cascade.sol` (7 contracts, 102 detectors), 22 results.

Findings applicable to Cascade source (not OZ imports):

| Detector | Finding | Disposition |
|---|---|---|
| `locked-ether` | `receive`/`fallback` are `payable` but always revert | False positive — intentional reject pattern (L-01) |
| `timestamp` | 4 `block.timestamp` comparisons | Acceptable on Arc — see L-02 |
| `cyclomatic-complexity` | `createChild` complexity 14 | Informational — see I-01 |
| `pragma` | OZ imports use older pragma ranges | OZ dependency, not Cascade source |
| `solc-version` | OZ imports reference old solc versions | OZ dependency, compiler is 0.8.28 |
| `assembly` | OZ `StorageSlot` uses inline assembly | OZ dependency, unrelated to Cascade |

No high or critical Slither detectors fired on Cascade source.

---

## What was NOT reviewed

- Off-chain frontend logic (separate review scope)
- Circle/Arc network-level censorship or sequencer behaviour
- USDC contract itself (`0x3600...`) — assumed correct
- OpenZeppelin 5.6.1 `SafeERC20`, `ReentrancyGuard` internals — assumed correct

---

## Recommended actions before mainnet deployment

1. **Address M-01**: Add `block.chainid` and USDC address assertions to the constructor.
2. **Address M-02**: Decide on and document the expire-race policy for `Submitted` commitments; consider a grace period.
3. **Address M-03**: Document the maximum fund-lock duration for deep trees; consider a minimum deadline validation.
4. **Engage an independent professional auditor** before any mainnet deployment or handling of material funds.
5. **Submit source verification** to the Arc Testnet explorer for public transparency.
