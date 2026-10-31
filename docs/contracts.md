# Contract reference

`contracts/Cascade.sol` — Solidity 0.8.28, compiled with the Cancun EVM target, optimizer runs 200.

The contract is immutable. There are no admin keys, no proxy pattern, no protocol fees, no governance, and no upgrade path.

---

## Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `MAX_DEPTH` | 8 | Maximum tree depth (root = depth 0) |
| `MAX_CHILDREN` | 16 | Maximum direct children per commitment |

---

## Enumerations

### `State`

| Value | Meaning |
|-------|---------|
| `Active` (0) | Commitment is open; manager may create children or submit delivery |
| `Submitted` (1) | Delivery reference recorded; awaiting approver action |
| `Succeeded` (2) | Terminal — approver approved; USDC credited to claimable |
| `Failed` (3) | Terminal — rejected, cancelled, or expired; unspent USDC returned to parent |

### `FailReason`

| Value | Meaning |
|-------|---------|
| `None` (0) | Not failed |
| `Rejected` (1) | Approver called `reject` |
| `Cancelled` (2) | Approver called `cancel` |
| `Expired` (3) | Anyone called `expire` after deadline |

---

## Commitment struct

```solidity
struct Commitment {
    uint256    id;
    uint256    parentId;        // 0 → root
    address    manager;
    address    approver;
    address    client;          // original funder (root only)
    uint256    budget;          // original allocation (6-decimal USDC)
    uint256    remaining;       // unspent escrowed amount
    uint256    delegationLimit; // root only: max live+settled downstream exposure
    uint256    allocated;       // root: live+settled exposure; non-root: sum of child budgets
    uint64     deadline;
    uint8      depth;           // 0 = root
    uint8      childCount;
    State      state;
    FailReason failReason;
    string     title;
    string     deliveryRef;
}
```

---

## State variables

| Variable | Visibility | Type | Description |
|----------|-----------|------|-------------|
| `usdc` | `public immutable` | `IERC20` | USDC ERC-20 contract |
| `claimable` | `public` | `mapping(address → uint256)` | Accumulated approved USDC per address |
| `totalEscrowed` | `public` | `uint256` | Sum of all `commitment.remaining` |
| `totalClaimable` | `public` | `uint256` | Sum of all `claimable[address]` |

---

## Write functions

### `createRoot`

```solidity
function createRoot(
    address manager,
    uint256 amount,
    uint256 delegationLimit,
    uint64  deadline,
    string calldata title
) external nonReentrant returns (uint256 id)
```

Caller becomes `client` and `approver`. Transfers `amount` USDC from caller into contract escrow.

**Reverts:** `InvalidAddress`, `InvalidAmount`, `DelegationLimitExceedsBudget`, `InvalidDeadline`

---

### `createChild`

```solidity
function createChild(
    uint256 parentId,
    address manager,
    uint256 amount,
    uint64  deadline,
    string calldata title
) external nonReentrant returns (uint256 id)
```

Called by the parent's `manager`. No additional USDC transfer — funds flow via internal accounting only. The new child's `approver` is inherited from the parent.

**Reverts:** `CommitmentNotFound`, `NotActive`, `NotManager`, `InvalidAddress`, `InvalidAmount`, `InvalidDeadline`, `DeadlineExceedsParent`, `MaxDepthExceeded`, `MaxChildrenExceeded`, `InsufficientFunds`, `ReservedBudgetViolation`, `DelegationCapacityExceeded`

---

### `submit`

```solidity
function submit(uint256 id, string calldata deliveryRef) external
```

Called by the commitment's `manager`. Records a delivery reference and moves state to `Submitted`. All direct children must be terminal.

**Reverts:** `NotManager`, `NotActive`, `EmptyDeliveryRef`, `DeadlinePassed`, `ChildrenNotTerminal`

---

### `approve`

```solidity
function approve(uint256 id) external nonReentrant
```

Called by the commitment's `approver`. Moves state to `Succeeded` and credits `remaining` to `claimable[manager]`. All direct children must be terminal.

**Reverts:** `NotApprover`, `NotSubmitted`, `ChildrenNotTerminal`

---

### `reject`

```solidity
function reject(uint256 id) external nonReentrant
```

Called by the commitment's `approver`. Requires state to be `Submitted`. Moves state to `Failed(Rejected)`. Returns `remaining` to parent.

**Reverts:** `NotApprover`, `NotSubmitted`

---

### `cancel`

```solidity
function cancel(uint256 id) external nonReentrant
```

Called by the commitment's `approver`. Requires state to be `Active` and all direct children terminal. Moves state to `Failed(Cancelled)`. Returns `remaining` to parent.

**Reverts:** `NotApprover`, `NotActive`, `ChildrenNotTerminal`

---

### `expire`

```solidity
function expire(uint256 id) external nonReentrant
```

Callable by anyone. Requires `block.timestamp > deadline` and all children terminal. Moves state to `Failed(Expired)`. Returns `remaining` to parent.

**Reverts:** `AlreadyTerminal`, `DeadlineNotExpired`, `ChildrenNotTerminal`

---

### `claim`

```solidity
function claim() external nonReentrant
```

Transfers `claimable[msg.sender]` USDC to the caller.

**Reverts:** `NothingToClaim`

---

## Read functions

| Function | Returns | Description |
|----------|---------|-------------|
| `commitment(uint256 id)` | `Commitment` | Full commitment struct |
| `children(uint256 id)` | `uint256[]` | Ordered list of child ids |
| `nextId()` | `uint256` | Next id to be assigned |
| `usdc()` | `address` | USDC contract address |
| `claimable(address)` | `uint256` | Claimable USDC for an address |
| `totalEscrowed()` | `uint256` | Sum of all `remaining` |
| `totalClaimable()` | `uint256` | Sum of all claimable balances |

---

## Events

| Event | Indexed params | Description |
|-------|---------------|-------------|
| `RootCreated(id, client, manager, budget, delegationLimit, deadline, title)` | id, client, manager | New root commitment funded |
| `ChildCreated(id, parentId, manager, approver, budget, deadline, title)` | id, parentId, manager | New child commitment allocated |
| `FundsReturned(parentId, childId, amount)` | parentId, childId | Unspent USDC returned to parent on failure |
| `DeliverySubmitted(id, deliveryRef)` | id | Delivery reference recorded |
| `CommitmentApproved(id, approver, released)` | id, approver | Approved; USDC credited to claimable |
| `CommitmentRejected(id, approver)` | id, approver | Rejected |
| `CommitmentCancelled(id, approver)` | id, approver | Cancelled |
| `CommitmentExpired(id, caller)` | id | Expired |
| `Claimed(account, amount)` | account | USDC withdrawn by manager |

---

## Errors

`InvalidAddress` · `InvalidAmount` · `InvalidDeadline` · `DelegationLimitExceedsBudget` · `DeadlineExceedsParent` · `MaxDepthExceeded` · `MaxChildrenExceeded` · `InsufficientFunds` · `ReservedBudgetViolation` · `DelegationCapacityExceeded` · `NotManager` · `NotApprover` · `NotActive` · `NotSubmitted` · `AlreadyTerminal` · `ChildrenNotTerminal` · `EmptyDeliveryRef` · `DeadlinePassed` · `DeadlineNotExpired` · `NothingToClaim` · `NativeNotAccepted` · `CommitmentNotFound`

---

## Financial invariants

These hold after every transaction:

```
totalEscrowed  == Σ commitment[i].remaining   for all i
totalClaimable == Σ claimable[address]         for all addresses
usdc.balanceOf(Cascade) >= totalEscrowed + totalClaimable
```

### Delegation limit semantics

`root.allocated` tracks **currently exposed capital** — not cumulative historical volume:

```
root.allocated = live capital inside active/submitted direct children
               + capital already permanently settled via successful descendants
```

The delegation guard on `createChild` (for direct root children) is:

```
root.allocated + amount <= root.delegationLimit
```

When a direct root child **fails**, its unspent portion is freed:

```
root.allocated -= child.remaining (at time of failure)
```

This means a failed child that returned all its funds frees its full slot for reuse; a partially-settled child frees only the portion it returned.

### Protected reserve

```
reservedBudget = root.budget - root.delegationLimit
```

At all times while the root is active:

```
root.remaining >= reservedBudget
```

The reserve is only released when the root itself resolves (approve / reject / cancel / expire).

---

## Deployment

The contract is deployed with a single constructor argument: the USDC ERC-20 address.

```
Arc Testnet / Mainnet USDC: 0x3600000000000000000000000000000000000000
```

See [`docs/deployment.md`](deployment.md) for reproducible deployment instructions.
