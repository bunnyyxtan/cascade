// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  Cascade
 * @notice Programmable USDC financial-authority protocol for autonomous agent supply chains
 *         on Arc.  A client funds an objective in USDC, appoints a lead manager with a
 *         delegation limit, and the manager allocates authorised funds to specialists, who
 *         can delegate further, forming a tree of funded commitments.
 *
 *         Accounting uses 6-decimal ERC-20 USDC exclusively.  Arc's native 18-decimal gas
 *         token is never touched; the contract rejects any native-value call.
 *
 * ── Delegation-limit semantics ────────────────────────────────────────────────
 *
 *  root.allocated tracks CURRENTLY EXPOSED capital on the root:
 *    = USDC live inside active/submitted direct children
 *    + USDC already permanently settled via successful descendants
 *
 *  When a direct child of root FAILS, its unspent remaining returns to root.remaining
 *  AND root.allocated is reduced by that same unspent amount.  The portion that was
 *  already consumed by successful grandchildren stays in allocated permanently.
 *
 *  This means the delegation guard ( root.allocated + amount <= root.delegationLimit )
 *  measures LIVE + SETTLED exposure, not cumulative historical volume.  A failed child
 *  that returned all its funds frees its full slot; a partially-settled child frees only
 *  the portion it returned.
 *
 * ── Accounting invariants ─────────────────────────────────────────────────────
 *
 *  totalEscrowed  == sum of all commitment.remaining
 *  totalClaimable == sum of all claimable[address]
 *  usdc.balanceOf(this) >= totalEscrowed + totalClaimable
 *
 *  The balance inequality (not equality) is deliberate: unsolicited ERC-20 transfers
 *  into the contract cannot break the invariant or inflate recorded obligations.
 */
contract Cascade is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────────

    uint8 public constant MAX_DEPTH    = 8;
    uint8 public constant MAX_CHILDREN = 16;

    // ─── Enumerations ────────────────────────────────────────────────────────────

    enum State {
        Active,    // 0
        Submitted, // 1
        Succeeded, // 2 — terminal
        Failed     // 3 — terminal
    }

    enum FailReason {
        None,      // 0
        Rejected,  // 1
        Cancelled, // 2
        Expired    // 3
    }

    // ─── Data structures ─────────────────────────────────────────────────────────

    struct Commitment {
        uint256    id;
        uint256    parentId;        // 0 ⇒ root (no parent commitment)
        address    manager;         // performs the work; may create children
        address    approver;        // may accept / reject / cancel
        address    client;          // original funder (only meaningful on root)
        uint256    budget;          // original allocation (6-dec USDC)
        uint256    remaining;       // unspent escrowed amount
        uint256    delegationLimit; // root only: max live+settled exposure allowed downstream
        uint256    allocated;       // root: live+settled exposure; non-root: sum of child budgets
        uint64     deadline;        // unix timestamp
        uint8      depth;           // 0 = root
        uint8      childCount;      // direct child counter (for MAX_CHILDREN guard)
        State      state;
        FailReason failReason;
        string     title;
        string     deliveryRef;
    }

    // ─── Immutables ──────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    // ─── State variables ─────────────────────────────────────────────────────────

    uint256 private _nextId = 1;

    /// id ⇒ Commitment
    mapping(uint256 => Commitment) private _commitments;

    /// parentId ⇒ ordered list of child ids (append-only; used for terminal checks)
    mapping(uint256 => uint256[]) private _children;

    /// address ⇒ USDC available to claim
    mapping(address => uint256) public claimable;

    /// Invariant: sum of _commitments[i].remaining for all i
    uint256 public totalEscrowed;

    /// Invariant: sum of claimable[a] for all a
    uint256 public totalClaimable;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event RootCreated(
        uint256 indexed id,
        address indexed client,
        address indexed manager,
        uint256 budget,
        uint256 delegationLimit,
        uint64  deadline,
        string  title
    );

    event ChildCreated(
        uint256 indexed id,
        uint256 indexed parentId,
        address indexed manager,
        address approver,
        uint256 budget,
        uint64  deadline,
        string  title
    );

    /// @notice Emitted when a failed child returns unspent funds to its parent.
    event FundsReturned(
        uint256 indexed parentId,
        uint256 indexed childId,
        uint256 amount
    );

    event DeliverySubmitted(uint256 indexed id, string deliveryRef);
    event CommitmentApproved(uint256 indexed id, address indexed approver, uint256 released);
    event CommitmentRejected(uint256 indexed id, address indexed approver);
    event CommitmentCancelled(uint256 indexed id, address indexed approver);
    event CommitmentExpired(uint256 indexed id, address indexed caller);
    event Claimed(address indexed account, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error DelegationLimitExceedsBudget();
    error DeadlineExceedsParent();
    error MaxDepthExceeded();
    error MaxChildrenExceeded();
    error InsufficientFunds();
    error ReservedBudgetViolation();
    error DelegationCapacityExceeded();
    error NotManager();
    error NotApprover();
    error NotActive();
    error NotSubmitted();
    error AlreadyTerminal();
    error ChildrenNotTerminal();
    error EmptyDeliveryRef();
    error DeadlinePassed();      // submit called after deadline
    error DeadlineNotExpired();  // expire called before deadline
    error NothingToClaim();
    error NativeNotAccepted();
    error CommitmentNotFound();

    // ─── Constructor ─────────────────────────────────────────────────────────────

    /**
     * @param usdcAddress  ERC-20 USDC address.
     *                     Arc Testnet/Mainnet: 0x3600000000000000000000000000000000000000.
     *                     Pass a mock in tests.
     */
    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert InvalidAddress();
        usdc = IERC20(usdcAddress);
    }

    // ─── Reject native value ─────────────────────────────────────────────────────

    receive()  external payable { revert NativeNotAccepted(); }
    fallback() external payable { revert NativeNotAccepted(); }

    // ─── Root creation ───────────────────────────────────────────────────────────

    /**
     * @notice Fund a new root commitment and become its approver.
     * @param manager         Lead manager.
     * @param amount          USDC to escrow (6-decimal).
     * @param delegationLimit Max live+settled downstream exposure.  Must be ≤ amount.
     * @param deadline        Unix timestamp; must be in the future.
     * @param title           Human-readable label.
     * @return id             New commitment id.
     */
    function createRoot(
        address        manager,
        uint256        amount,
        uint256        delegationLimit,
        uint64         deadline,
        string calldata title
    ) external nonReentrant returns (uint256 id) {
        if (manager == address(0))          revert InvalidAddress();
        if (amount == 0)                    revert InvalidAmount();
        if (delegationLimit > amount)       revert DelegationLimitExceedsBudget();
        if (deadline <= block.timestamp)    revert InvalidDeadline();

        id = _nextId++;

        _commitments[id] = Commitment({
            id:              id,
            parentId:        0,
            manager:         manager,
            approver:        msg.sender,
            client:          msg.sender,
            budget:          amount,
            remaining:       amount,
            delegationLimit: delegationLimit,
            allocated:       0,
            deadline:        deadline,
            depth:           0,
            childCount:      0,
            state:           State.Active,
            failReason:      FailReason.None,
            title:           title,
            deliveryRef:     ""
        });

        totalEscrowed += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit RootCreated(id, msg.sender, manager, amount, delegationLimit, deadline, title);
    }

    // ─── Child creation ──────────────────────────────────────────────────────────

    /**
     * @notice Allocate a portion of a commitment's budget to a new child commitment.
     *         No additional USDC transfer; funds flow via internal accounting only.
     *
     * Delegation-limit semantics (root direct children only):
     *   reservedBudget  = root.budget - root.delegationLimit
     *   Invariant:       root.remaining >= reservedBudget  (at all times while root is active)
     *   Equivalent to:   root.allocated <= root.delegationLimit
     *
     * root.allocated = live + permanently-settled exposure (not cumulative history).
     * When a direct child fails, its unspent portion is freed from allocated.
     *
     * For grandchildren and deeper descendants the constraint does not apply;
     * they draw from capital already inside the delegation mandate.
     *
     * @param parentId  Parent commitment id.
     * @param manager   Manager of the new child.
     * @param amount    USDC to allocate.
     * @param deadline  Must be > now and ≤ parent deadline.
     * @param title     Label.
     * @return id       New commitment id.
     */
    function createChild(
        uint256        parentId,
        address        manager,
        uint256        amount,
        uint64         deadline,
        string calldata title
    ) external nonReentrant returns (uint256 id) {
        Commitment storage parent = _commitments[parentId];
        if (parent.id == 0)                        revert CommitmentNotFound();
        if (parent.state != State.Active)           revert NotActive();
        if (parent.manager != msg.sender)           revert NotManager();
        if (manager == address(0))                  revert InvalidAddress();
        if (amount == 0)                            revert InvalidAmount();
        if (deadline <= block.timestamp)            revert InvalidDeadline();
        if (deadline > parent.deadline)             revert DeadlineExceedsParent();

        uint8 newDepth = parent.depth + 1;
        if (newDepth > MAX_DEPTH)                   revert MaxDepthExceeded();
        if (parent.childCount >= MAX_CHILDREN)      revert MaxChildrenExceeded();

        // ── Delegation-limit guard (root direct children only) ────────────────
        if (parent.depth == 0) {
            // Live+settled exposure must not exceed delegationLimit.
            if (parent.allocated + amount > parent.delegationLimit) {
                revert DelegationCapacityExceeded();
            }
            // Equivalent reserved-floor check (defence in depth).
            uint256 reserved = parent.budget - parent.delegationLimit;
            if (parent.remaining < amount || parent.remaining - amount < reserved) {
                revert ReservedBudgetViolation();
            }
        } else {
            // Non-root parent: simply require sufficient remaining funds.
            if (parent.remaining < amount) revert InsufficientFunds();
        }

        id = _nextId++;

        // Internal accounting: deduct from parent's remaining; raise exposure tracker.
        parent.remaining  -= amount;
        parent.allocated  += amount;
        parent.childCount += 1;

        // The child's approver is always the parent's manager.
        _commitments[id] = Commitment({
            id:              id,
            parentId:        parentId,
            manager:         manager,
            approver:        parent.manager,
            client:          address(0),
            budget:          amount,
            remaining:       amount,
            delegationLimit: amount,  // non-root children may sub-delegate their full budget
            allocated:       0,
            deadline:        deadline,
            depth:           newDepth,
            childCount:      0,
            state:           State.Active,
            failReason:      FailReason.None,
            title:           title,
            deliveryRef:     ""
        });

        _children[parentId].push(id);

        emit ChildCreated(id, parentId, manager, parent.manager, amount, deadline, title);
    }

    // ─── Submission ──────────────────────────────────────────────────────────────

    /**
     * @notice Manager submits a delivery reference.
     *         All direct children must already be terminal.
     *         Deadline must not have passed.
     */
    function submit(uint256 id, string calldata deliveryRef) external {
        Commitment storage c = _commitments[id];
        if (c.id == 0)                         revert CommitmentNotFound();
        if (c.manager != msg.sender)           revert NotManager();
        if (c.state != State.Active)           revert NotActive();
        if (block.timestamp > c.deadline)      revert DeadlinePassed();
        if (bytes(deliveryRef).length == 0)    revert EmptyDeliveryRef();
        _requireChildrenTerminal(id);

        c.state       = State.Submitted;
        c.deliveryRef = deliveryRef;

        emit DeliverySubmitted(id, deliveryRef);
    }

    // ─── Approval ────────────────────────────────────────────────────────────────

    /**
     * @notice Approver accepts submitted work.
     *         Releases the commitment's remaining balance to the manager's claimable.
     */
    function approve(uint256 id) external nonReentrant {
        Commitment storage c = _commitments[id];
        if (c.id == 0)                     revert CommitmentNotFound();
        if (c.approver != msg.sender)      revert NotApprover();
        if (c.state != State.Submitted)    revert NotSubmitted();

        uint256 released = c.remaining;
        c.remaining = 0;
        c.state     = State.Succeeded;

        claimable[c.manager] += released;
        totalEscrowed        -= released;
        totalClaimable       += released;

        emit CommitmentApproved(id, msg.sender, released);
    }

    // ─── Rejection ───────────────────────────────────────────────────────────────

    /**
     * @notice Approver rejects submitted work.
     *         Unspent remaining flows back up the tree.
     */
    function reject(uint256 id) external nonReentrant {
        Commitment storage c = _commitments[id];
        if (c.id == 0)                  revert CommitmentNotFound();
        if (c.approver != msg.sender)   revert NotApprover();
        if (c.state != State.Submitted) revert NotSubmitted();

        _failCommitment(id, FailReason.Rejected);
        emit CommitmentRejected(id, msg.sender);
    }

    // ─── Cancellation ────────────────────────────────────────────────────────────

    /**
     * @notice Approver cancels an Active commitment.
     *         All direct children must be terminal.
     */
    function cancel(uint256 id) external nonReentrant {
        Commitment storage c = _commitments[id];
        if (c.id == 0)                 revert CommitmentNotFound();
        if (c.approver != msg.sender)  revert NotApprover();
        if (c.state != State.Active)   revert NotActive();
        _requireChildrenTerminal(id);

        _failCommitment(id, FailReason.Cancelled);
        emit CommitmentCancelled(id, msg.sender);
    }

    // ─── Expiry ──────────────────────────────────────────────────────────────────

    /**
     * @notice Anyone may expire any commitment (Active or Submitted) whose deadline
     *         has passed and whose direct children are all terminal.
     *         Designed for permissionless bottom-up expiry chains.
     */
    function expire(uint256 id) external nonReentrant {
        Commitment storage c = _commitments[id];
        if (c.id == 0)                                              revert CommitmentNotFound();
        if (c.state == State.Succeeded || c.state == State.Failed)  revert AlreadyTerminal();
        if (block.timestamp <= c.deadline)                          revert DeadlineNotExpired();
        _requireChildrenTerminal(id);

        _failCommitment(id, FailReason.Expired);
        emit CommitmentExpired(id, msg.sender);
    }

    // ─── Claim ───────────────────────────────────────────────────────────────────

    /**
     * @notice Pull-based withdrawal of claimable USDC balance.
     *         Checks-Effects-Interactions pattern; protected by ReentrancyGuard.
     */
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender]  = 0;
        totalClaimable        -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // ─── View helpers ────────────────────────────────────────────────────────────

    function getCommitment(uint256 id) external view returns (Commitment memory) {
        return _commitments[id];
    }

    function getChildren(uint256 parentId) external view returns (uint256[] memory) {
        return _children[parentId];
    }

    function contractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function nextId() external view returns (uint256) {
        return _nextId;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────────

    /**
     * @dev Revert if any direct child of `parentId` is in a non-terminal state.
     */
    function _requireChildrenTerminal(uint256 parentId) internal view {
        uint256[] storage kids = _children[parentId];
        uint256 len = kids.length;
        for (uint256 i; i < len; ) {
            State s = _commitments[kids[i]].state;
            if (s != State.Succeeded && s != State.Failed) revert ChildrenNotTerminal();
            unchecked { ++i; }
        }
    }

    /**
     * @dev Mark a commitment as Failed and route its remaining balance:
     *        - root  → credit original client's claimable (totalEscrowed decreases)
     *        - child → return to parent's remaining (internal accounting, totalEscrowed unchanged)
     *
     *      For a direct child of root: also reduce root.allocated by the refund amount so that
     *      only live+settled exposure counts against the delegation mandate.  The settled portion
     *      (child.budget - child.remaining at time of failure) stays in allocated permanently
     *      because those funds were consumed by successful grandchildren.
     *
     *      Previously-succeeded descendant payments are never clawed back.
     */
    function _failCommitment(uint256 id, FailReason reason) internal {
        Commitment storage c = _commitments[id];
        uint256 refund = c.remaining;
        c.remaining   = 0;
        c.state       = State.Failed;
        c.failReason  = reason;

        if (refund == 0) return;

        if (c.parentId == 0) {
            // Root failure: credit the original funder.
            claimable[c.client] += refund;
            totalEscrowed       -= refund;
            totalClaimable      += refund;
        } else {
            // Non-root failure: return funds to parent (internal accounting only).
            Commitment storage parent = _commitments[c.parentId];
            parent.remaining += refund;

            // If this child is a DIRECT child of the root (depth == 1), restore the freed
            // delegation capacity so the root manager can reallocate it to a replacement.
            // Only the returned (unspent) portion is freed; settled amounts stay consumed.
            if (c.depth == 1) {
                // refund == c.remaining before zeroing == unspent portion
                parent.allocated -= refund;
            }

            emit FundsReturned(c.parentId, id, refund);
            // totalEscrowed is unchanged: funds remain in the contract.
        }
    }
}
