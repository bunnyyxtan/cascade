# Cascade V1: Security Review

**Date:** 2026-10-31  
**Reviewer:** Arc Studio (automated rule-corpus + functional-adversarial analysis + Slither static analysis + targeted adversarial Foundry tests)  
**Contract:** `contracts/Cascade.sol`  
**Compiler:** solc 0.8.28, cancun EVM, optimizer 200 runs  
**Deployed at:** `0xa87371b1127d88df309313ddcaa43b6191fa9a57` (Arc Testnet, chain ID 5042002)  
**On-chain codehash (keccak256):** `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29`  
**Bytecode match:** ✅ keccak256 of on-chain runtime code matches `VITE_CASCADE_CODEHASH` exactly  
**Adversarial tests:** `contracts/test/CascadeAdversarial.t.sol`: 26 tests, all passing

---

## Disclaimer

This review covers the contract source and deployed bytecode against known vulnerability patterns and the stated design intent. It does **not** constitute a professional third-party audit. The contract is immutable and holds user funds. **Do not use on mainnet before an independent professional audit is completed.**

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 2 (M-03 downgraded to Low after adversarial testing) |
| Low | 4 |
| Informational / Gas | 4 |

No fund-loss paths, re-entrancy vectors, permission bypasses, or accounting-invariant violations were identified. The design is conservative and correct for its stated scope. Targeted adversarial testing of all findings confirmed no exploitable vulnerabilities.

---

## Mainnet readiness decisions

| Finding | Decision | Rationale |
|---|---|---|
| M-01 Constructor no chain/USDC guard | **Fix before mainnet** | One-time deployment risk; cheap to prevent with constructor assertions. See corrected recommendation below. |
| M-02 Permissionless expire on Submitted | **Accept with documentation** | Tested: third party gains nothing; deadline is absolute by design; grace period would require new code and tests. NatSpec update sufficient. |
| M-03 Deep-tree fund lock (downgraded to Low) | **Accept** | Adversarial testing proves all funds are always recoverable via bottom-up expire. Root deadline is the hard outer bound. No permanent lock is possible. |
| 16-child slot not freed on failure | **Accept with documentation** | Designed behaviour. Managers must plan child counts. Funds are always recoverable via expire after deadline. |
| L-01 Slither locked-ether | Accept | False positive. |
| L-02 Slither timestamp | Accept for Arc | No meaningful manipulation on Arc's sequenced chain. |
| L-03 approve skips children check | Accept | Safe by construction; submit already enforces it. |
| I-01 cyclomatic complexity | Accept | Correctness over refactoring. |
| I-02 ID-0 sentinel | Accept | Pattern is sound; comment improves clarity. |
| I-03 No FundsReturned on root failure | Accept | Tested and documented. Callers can infer amount from the commitment's `remaining` at event time. |
| I-04 Unbounded string storage | Accept for V1 | Gas cost borne by caller; no fund-loss vector. |

---

## Findings

---

### M-01: Constructor does not enforce deployment invariants

**Severity:** Medium  
**Location:** `Cascade.sol:178–181`

```solidity
constructor(address usdcAddress) {
    if (usdcAddress == address(0)) revert InvalidAddress();
    usdc = IERC20(usdcAddress);
}
```

**Risk:** The constructor accepts any non-zero ERC-20 address as `usdc`. The protocol's entire accounting model assumes 6-decimal USDC on Arc. A misconfigured deployment (wrong token address, non-6-decimal ERC-20) would silently break economic correctness: amounts displayed in the frontend would be wrong and reserve calculations would fail at different decimal scales, with no recovery path because the contract is immutable. An Arc chain check would also prevent accidental mainnet or fork deployment with this address unchanged.

**Impact:** One-time deployment risk. Irreversible if triggered. Does not affect the already-deployed testnet instance (USDC address is confirmed correct on-chain).

**Recommended fix (corrected, must cover both Arc Testnet and Arc Mainnet):**

The original recommendation incorrectly hardcoded only `5042002` (Arc Testnet). A contract intended for Arc Mainnet (chain ID `5042`) would be permanently bricked by that check. The correct fix covers both:

```solidity
address private constant ARC_USDC = 0x3600000000000000000000000000000000000000;

constructor(address usdcAddress) {
    if (usdcAddress == address(0)) revert InvalidAddress();
    // Accept Arc Testnet (5042002) and Arc Mainnet (5042) only.
    require(
        block.chainid == 5042002 || block.chainid == 5042,
        "Cascade: wrong chain"
    );
    require(usdcAddress == ARC_USDC, "Cascade: wrong USDC");
    usdc = IERC20(usdcAddress);
}
```

**Effect on existing testnet deployment:** None. The existing deployment is immutable. This fix applies only to future redeployments. The frontend's codehash verification (`VITE_CASCADE_CODEHASH`) catches any bytecode mismatch on the deployed instance.

**Alternative (portable):** Omit the chain-ID check and rely entirely on deployment tooling and bytecode verification. Accept that the constructor is then permissive and document the deployment procedure carefully.

---

### M-02: `expire` is permissionless and can be called on any non-terminal commitment

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

**Adversarial test result:** `test_M02_thirdParty_expires_submitted_at_deadline` confirms the scenario occurs. `test_M02_thirdParty_gains_nothing_from_expiring` confirms the third party receives zero USDC; all funds return to the client (the approver). `test_M02_cannotApprove_afterExpire` and `test_M02_cannotExpire_afterApprove` confirm double-settlement is impossible in both directions.

**Impact:** A submitted commitment can be expired by a third party in the same block the deadline passes. The race window is exactly 1 block on Arc. Critically, the only party who receives the refunded funds is the *client*, who is also the *approver*. A hostile third party gains no financial reward; they pay gas and the client gets their own money back. The only realistic griefer is one acting out of pure spite at their own expense.

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

### L-04 (was M-03): Deep-tree fund lock: funds are always recoverable via bottom-up expire

**Severity:** Low (downgraded from Medium after adversarial testing; permanent fund loss is not possible)  
**Location:** `Cascade.sol:466–474`, `Cascade.sol:262–328`

**Design intent (correct):** `_requireChildrenTerminal` checks only *direct* children. This enforces the bottom-up resolution order: to resolve a parent you must first resolve all its children, to depth. `submit` and `cancel` enforce this; `expire` does too.

**Adversarial test result:** `test_M03_maxDepth_chain_fully_recoverable` builds a full 8-level-deep chain with all managers unresponsive and proves that bottom-up `expire` calls by any address recover 100% of funds to the client after the root deadline passes. No code path prevents this.

**Key constraint that limits the risk:** `deadline > parent.deadline` reverts at `createChild` (line 276: `DeadlineExceedsParent`). A malicious manager at depth 1 cannot set a deadline longer than the root deadline. The root deadline is the absolute outer bound for the entire tree, set by the client when creating the root.

**Remaining concern (Low, not Medium):** There is no minimum deadline check. A root with a 1-year deadline locks funds for up to 1 year before permissionless expire is available. This is a design tradeoff, not a vulnerability; the client chooses the deadline.

**16-child slot (additional finding, Accept):** `childCount` is increment-only. A cancelled or expired child does not free its slot. After 16 children, no new children can be created even if all previous ones failed. Tested by `test_16child_failedChild_doesNotFreeSlot`. Impact: managers must plan work allocation upfront. Funds in failed children are always recoverable via expire; only the slot is permanently consumed.

**Recommended action:** Document in NatSpec that `createChild` slots are permanent and that the root deadline bounds maximum lock duration. No code change required for V1.

---

### L-01: Slither: `locked-ether` false positive

**Severity:** Low  
**Location:** `Cascade.sol:185–186`

```solidity
receive()  external payable { revert NativeNotAccepted(); }
fallback() external payable { revert NativeNotAccepted(); }
```

**Finding:** Slither reports `locked-ether` because the functions are `payable` but always revert. **This is intentional and correct.** The `payable` modifier is required to intercept and reject native value sends; without it, native transfers would not route to these functions on some EVM implementations. No ETH or Arc native can ever be deposited.

**Action:** No fix required. This is a well-known Slither false positive for reject-on-receive patterns. A `// slither-disable-next-line locked-ether` comment can suppress the noise.

---

### L-02: Slither: `timestamp` manipulation

**Severity:** Low  
**Location:** `Cascade.sol:209, 275, 342, 419`

**Finding:** Slither flags all four `block.timestamp` comparisons. On Arc (sub-second finality, single sequencer), the timestamp is the chain's real clock time. Miners/validators cannot meaningfully manipulate it here. The deadline uses `uint64`, which is appropriate.

**Action:** No fix required for Arc. For any future cross-chain deployment to Ethereum mainnet or PoW chains, note that validators can manipulate `block.timestamp` by up to ~15 seconds, which could allow a commitment to be submitted in the same block its deadline appears to pass.

---

### L-03: `approve` does not guard against approving a commitment with active grandchildren

**Severity:** Low  
**Location:** `Cascade.sol:358–373`

**Risk:** `approve` only requires `state == Submitted`. It does not call `_requireChildrenTerminal`. However, `submit` already requires all direct children to be terminal before transitioning to `Submitted`. So at the time of `approve`, all direct children are terminal by construction. Grandchildren of children that succeeded could have been sub-delegated and resolved, but those are already terminal (as children of direct children, which were checked at submit time). The invariant holds transitively. **No bug here**, but it is worth noting explicitly in NatSpec.

**Action:** Add a NatSpec comment to `approve` confirming why the children check is not repeated.

---

### I-01: Slither: `cyclomatic-complexity` on `createChild`

**Severity:** Informational  
**Location:** `Cascade.sol:262–328`

Slither reports cyclomatic complexity 14 for `createChild`. The complexity comes from the dual path (root-parent vs non-root-parent delegation logic). The logic is correct and well-commented, but consider extracting the delegation-limit checks into an internal `_checkDelegation(parent, amount)` helper for readability.

---

### I-02: `_nextId` starts at 1; ID 0 is used as a sentinel

**Severity:** Informational  
**Location:** `Cascade.sol:93, 270`

`id == 0` is used as a "not found" sentinel (`if (parent.id == 0) revert CommitmentNotFound()`). This is correct because `_nextId` starts at 1 and is only incremented. Mappings return the zero value for missing keys, so an unmapped `id` returns a `Commitment` with `id == 0`. The pattern is sound but non-obvious; a comment at the mapping declaration would help.

---

### I-03: No event emitted when a root commitment fails via `_failCommitment`

**Severity:** Informational  
**Location:** `Cascade.sol:488–518`

When a root commitment fails, `claimable[c.client]` is updated and `CommitmentRejected` / `CommitmentCancelled` / `CommitmentExpired` is emitted by the caller. However, no `FundsReturned` event is emitted for root failures (only for non-root failures, line 515). The client's claimable balance increase is only discoverable by watching `CommitmentRejected`/`Cancelled`/`Expired` and inferring the amount from the commitment's `remaining` at the time. Adding a `FundsReturned` for the root case (or a `RootRefunded(id, client, amount)` event) would make the event log self-contained.

---

### I-04: `string` storage for `title` and `deliveryRef` in structs is unbounded

**Severity:** Informational / Gas  
**Location:** `Cascade.sol:83–84`

`title` and `deliveryRef` are stored as unbounded `string` in the commitment struct. No length validation is performed. A very long string increases storage cost and event log size. Consider adding a `MAX_STRING_LEN` guard (e.g., 256 bytes) in `createRoot`, `createChild`, and `submit`. This is also a mild griefing vector; a client or manager can fill storage with large strings at their own gas cost.

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
| `locked-ether` | `receive`/`fallback` are `payable` but always revert | False positive; intentional reject pattern (L-01) |
| `timestamp` | 4 `block.timestamp` comparisons | Acceptable on Arc (see L-02) |
| `cyclomatic-complexity` | `createChild` complexity 14 | Informational (see I-01) |
| `pragma` | OZ imports use older pragma ranges | OZ dependency, not Cascade source |
| `solc-version` | OZ imports reference old solc versions | OZ dependency, compiler is 0.8.28 |
| `assembly` | OZ `StorageSlot` uses inline assembly | OZ dependency, unrelated to Cascade |

No high or critical Slither detectors fired on Cascade source.

---

## What was NOT reviewed

- Off-chain frontend logic (separate review scope)
- Circle/Arc network-level censorship or sequencer behaviour
- USDC contract itself (`0x3600...`): assumed correct
- OpenZeppelin 5.6.1 `SafeERC20`, `ReentrancyGuard` internals: assumed correct

---

## Recommended actions before mainnet deployment

1. **Fix M-01**: Add `block.chainid` (covering both Arc Testnet 5042002 and Arc Mainnet 5042) and USDC address assertions to the constructor. Does not affect the current testnet deployment.
2. **Document M-02**: Update NatSpec on `expire` to state explicitly that deadlines are absolute. A `Submitted` commitment can be expired once the deadline passes. Managers should not submit in the final block of their deadline window.
3. **Document L-04 / 16-child**: Update NatSpec on `createChild` to state that child slots are permanent and the root deadline bounds the maximum recovery wait for any subtree.
4. **Engage an independent professional auditor** before any mainnet deployment or handling of material funds. This review and its tests do not substitute for a professional audit.
5. **Submit source verification** to the Arc Testnet explorer for public transparency.
