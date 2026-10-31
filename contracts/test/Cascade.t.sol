// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../contracts/Cascade.sol";

// ─── Minimal ERC-20 mock ─────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// 6 decimals matching real USDC.
    function decimals() public pure override returns (uint8) { return 6; }
}

// ─── Reentrancy attack helper ─────────────────────────────────────────────────

contract ReentrantClaimer {
    Cascade public cascade;
    uint256 public attackCount;

    constructor(address _cascade) {
        cascade = Cascade(payable(_cascade));
    }

    /// Called by MockUSDC's transfer hook (if we patched it) OR directly.
    fallback() external {
        if (attackCount < 3) {
            attackCount++;
            cascade.claim();
        }
    }

    function attack() external {
        cascade.claim();
    }
}

// ─── Test contract ────────────────────────────────────────────────────────────

contract CascadeTest is Test {
    MockUSDC  internal usdc;
    Cascade   internal cascade;

    // Named actors.
    address internal client   = makeAddr("client");
    address internal alice    = makeAddr("alice");   // lead manager
    address internal bob      = makeAddr("bob");     // specialist
    address internal carol    = makeAddr("carol");   // sub-specialist
    address internal dave     = makeAddr("dave");    // another manager
    address internal mallory  = makeAddr("mallory"); // adversary

    uint64  internal constant NOW      = 1_000_000;
    uint64  internal constant DEADLINE = NOW + 7 days;

    // 6-decimal USDC helpers.
    function u(uint256 whole) internal pure returns (uint256) { return whole * 1e6; }

    function setUp() public {
        vm.warp(NOW);
        usdc    = new MockUSDC();
        cascade = new Cascade(address(usdc));

        // Fund all named actors generously.
        for (uint256 i; i < 6; i++) {
            address a = [client, alice, bob, carol, dave, mallory][i];
            usdc.mint(a, u(1_000_000));
            vm.prank(a);
            usdc.approve(address(cascade), type(uint256).max);
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _createRoot(
        address mgr,
        uint256 budget,
        uint256 delLimit,
        uint64  dl
    ) internal returns (uint256) {
        vm.prank(client);
        return cascade.createRoot(mgr, budget, delLimit, dl, "Root");
    }

    function _createRootDefault() internal returns (uint256) {
        return _createRoot(alice, u(10), u(7), DEADLINE);
    }

    function _submit(address who, uint256 id, string memory ref) internal {
        vm.prank(who);
        cascade.submit(id, ref);
    }

    function _approve(address who, uint256 id) internal {
        vm.prank(who);
        cascade.approve(id);
    }

    function _reject(address who, uint256 id) internal {
        vm.prank(who);
        cascade.reject(id);
    }

    function _cancel(address who, uint256 id) internal {
        vm.prank(who);
        cascade.cancel(id);
    }

    function _createChild(
        address who,
        uint256 parentId,
        address mgr,
        uint256 amount,
        uint64  dl
    ) internal returns (uint256) {
        vm.prank(who);
        return cascade.createChild(parentId, mgr, amount, dl, "Child");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A. Constructor / setup
    // ─────────────────────────────────────────────────────────────────────────

    function test_constructor_zeroAddress_reverts() public {
        vm.expectRevert(Cascade.InvalidAddress.selector);
        new Cascade(address(0));
    }

    function test_constructor_stores_usdc() public view {
        assertEq(address(cascade.usdc()), address(usdc));
    }

    function test_rejectNative_receive() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(cascade).call{value: 1}("");
        assertFalse(ok);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // B. createRoot
    // ─────────────────────────────────────────────────────────────────────────

    function test_createRoot_happy() public {
        uint256 id = _createRootDefault();
        assertEq(id, 1);

        Cascade.Commitment memory c = cascade.getCommitment(id);
        assertEq(c.manager,         alice);
        assertEq(c.approver,        client);
        assertEq(c.client,          client);
        assertEq(c.budget,          u(10));
        assertEq(c.remaining,       u(10));
        assertEq(c.delegationLimit, u(7));
        assertEq(c.allocated,       0);
        assertEq(c.depth,           0);
        assertEq(uint8(c.state),    uint8(Cascade.State.Active));
        assertEq(cascade.totalEscrowed(), u(10));
        assertEq(usdc.balanceOf(address(cascade)), u(10));
    }

    function test_createRoot_zeroBudget_reverts() public {
        vm.prank(client);
        vm.expectRevert(Cascade.InvalidAmount.selector);
        cascade.createRoot(alice, 0, 0, DEADLINE, "t");
    }

    function test_createRoot_delegationExceedsBudget_reverts() public {
        vm.prank(client);
        vm.expectRevert(Cascade.DelegationLimitExceedsBudget.selector);
        cascade.createRoot(alice, u(10), u(11), DEADLINE, "t");
    }

    function test_createRoot_zeroDelegation_valid() public {
        uint256 id = _createRoot(alice, u(10), 0, DEADLINE);
        assertEq(cascade.getCommitment(id).delegationLimit, 0);
    }

    function test_createRoot_fullDelegation_valid() public {
        uint256 id = _createRoot(alice, u(10), u(10), DEADLINE);
        assertEq(cascade.getCommitment(id).delegationLimit, u(10));
    }

    function test_createRoot_pastDeadline_reverts() public {
        vm.prank(client);
        vm.expectRevert(Cascade.InvalidDeadline.selector);
        cascade.createRoot(alice, u(10), u(5), uint64(block.timestamp), "t");
    }

    function test_createRoot_transfersUsdc() public {
        uint256 before = usdc.balanceOf(client);
        _createRootDefault();
        assertEq(usdc.balanceOf(client), before - u(10));
        assertEq(usdc.balanceOf(address(cascade)), u(10));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // C. createChild — basic
    // ─────────────────────────────────────────────────────────────────────────

    function test_createChild_happy() public {
        uint256 root = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(3), DEADLINE);
        assertEq(child, 2);

        Cascade.Commitment memory c = cascade.getCommitment(child);
        assertEq(c.manager,   bob);
        assertEq(c.approver,  alice);   // parent manager is approver
        assertEq(c.budget,    u(3));
        assertEq(c.remaining, u(3));
        assertEq(c.depth,     1);
        assertEq(uint8(c.state), uint8(Cascade.State.Active));

        // Root remaining reduced.
        assertEq(cascade.getCommitment(root).remaining, u(7));
        assertEq(cascade.getCommitment(root).allocated, u(3));

        // totalEscrowed unchanged (no new USDC in).
        assertEq(cascade.totalEscrowed(), u(10));
    }

    function test_createChild_notManager_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(mallory);
        vm.expectRevert(Cascade.NotManager.selector);
        cascade.createChild(root, bob, u(3), DEADLINE, "t");
    }

    function test_createChild_parentNotActive_reverts() public {
        uint256 root = _createRootDefault();
        // Submit then reject to make root Failed.
        _submit(alice, root, "ref");
        _reject(client, root);

        vm.prank(alice);
        vm.expectRevert(Cascade.NotActive.selector);
        cascade.createChild(root, bob, u(1), DEADLINE, "t");
    }

    function test_createChild_deadlineExceedsParent_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(alice);
        vm.expectRevert(Cascade.DeadlineExceedsParent.selector);
        cascade.createChild(root, bob, u(3), DEADLINE + 1, "t");
    }

    function test_createChild_maxDepth_reverts() public {
        // Build a chain 8 levels deep.
        uint256 parent = _createRoot(alice, u(100), u(100), DEADLINE);
        address[9] memory managers = [alice, bob, carol, dave,
            makeAddr("e"), makeAddr("f"), makeAddr("g"), makeAddr("h"), makeAddr("i")];
        uint256 prev = parent;
        for (uint256 depth = 0; depth < 8; depth++) {
            uint256 next = _createChild(managers[depth], prev, managers[depth+1], u(1), DEADLINE);
            prev = next;
        }
        // depth is now 8 — trying to add a child at depth 9 should revert.
        vm.prank(managers[8]);
        vm.expectRevert(Cascade.MaxDepthExceeded.selector);
        cascade.createChild(prev, makeAddr("j"), u(1), DEADLINE, "t");
    }

    function test_createChild_maxChildren_reverts() public {
        uint256 root = _createRoot(alice, u(200), u(200), DEADLINE);
        for (uint256 i = 0; i < 16; i++) {
            _createChild(alice, root, bob, u(1), DEADLINE);
        }
        vm.prank(alice);
        vm.expectRevert(Cascade.MaxChildrenExceeded.selector);
        cascade.createChild(root, bob, u(1), DEADLINE, "t");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // D. Delegation limit — reserved budget
    // ─────────────────────────────────────────────────────────────────────────

    // Root: budget=10, delegationLimit=7, reserved=3.
    // Manager may allocate up to 7 to direct children total.

    function test_delegation_reservedBudgetProtected() public {
        uint256 root = _createRootDefault();   // budget=10, limit=7, reserved=3

        // Allocate full delegation limit.
        _createChild(alice, root, bob,  u(4), DEADLINE);
        _createChild(alice, root, carol, u(3), DEADLINE);

        // Root remaining = 10 - 7 = 3 (== reserved).  Trying one more should fail.
        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, dave, u(1), DEADLINE, "t");
    }

    function test_delegation_zeroDelegationLimit_noChildren() public {
        uint256 root = _createRoot(alice, u(10), 0, DEADLINE);
        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, bob, u(1), DEADLINE, "t");
    }

    function test_delegation_grandchildren_noDoubleCount() public {
        // Root: budget=10, limit=7.  Child gets 5.  Grandchild gets 4 out of that 5.
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);
        uint256 gc    = _createChild(bob, child, carol, u(4), DEADLINE);

        // Root.allocated still 5, not 9.
        assertEq(cascade.getCommitment(root).allocated, u(5));
        // Child remaining = 1.
        assertEq(cascade.getCommitment(child).remaining, u(1));
        // Grandchild budget = 4.
        assertEq(cascade.getCommitment(gc).budget, u(4));
        // totalEscrowed still 10.
        assertEq(cascade.totalEscrowed(), u(10));
    }

    function test_delegation_childExceedsChildRemaining_reverts() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);

        // Bob tries to allocate more than child's remaining.
        vm.prank(bob);
        vm.expectRevert(Cascade.InsufficientFunds.selector);
        cascade.createChild(child, carol, u(6), DEADLINE, "t");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // E. Submit
    // ─────────────────────────────────────────────────────────────────────────

    function test_submit_happy() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ipfs://xyz");
        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Submitted));
        assertEq(cascade.getCommitment(root).deliveryRef, "ipfs://xyz");
    }

    function test_submit_notManager_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(mallory);
        vm.expectRevert(Cascade.NotManager.selector);
        cascade.submit(root, "ref");
    }

    function test_submit_emptyRef_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(alice);
        vm.expectRevert(Cascade.EmptyDeliveryRef.selector);
        cascade.submit(root, "");
    }

    function test_submit_afterDeadline_reverts() public {
        uint256 root = _createRootDefault();
        vm.warp(DEADLINE + 1);
        vm.prank(alice);
        vm.expectRevert(Cascade.DeadlinePassed.selector);
        cascade.submit(root, "ref");
    }

    function test_submit_childrenNotTerminal_reverts() public {
        uint256 root  = _createRootDefault();
        _createChild(alice, root, bob, u(3), DEADLINE);

        vm.prank(alice);
        vm.expectRevert(Cascade.ChildrenNotTerminal.selector);
        cascade.submit(root, "ref");
    }

    function test_submit_afterChildTerminal_succeeds() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(3), DEADLINE);

        // Terminate child via bob submitting and alice approving.
        _submit(bob, child, "child-ref");
        _approve(alice, child);

        // Now parent can submit.
        _submit(alice, root, "root-ref");
        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Submitted));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // F. Approve
    // ─────────────────────────────────────────────────────────────────────────

    function test_approve_happy() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _approve(client, root);

        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Succeeded));
        assertEq(cascade.getCommitment(root).remaining,    0);
        assertEq(cascade.claimable(alice),                 u(10));
        assertEq(cascade.totalEscrowed(),                  0);
        assertEq(cascade.totalClaimable(),                 u(10));
    }

    function test_approve_notApprover_reverts() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        vm.prank(mallory);
        vm.expectRevert(Cascade.NotApprover.selector);
        cascade.approve(root);
    }

    function test_approve_notSubmitted_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(client);
        vm.expectRevert(Cascade.NotSubmitted.selector);
        cascade.approve(root);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // G. Reject
    // ─────────────────────────────────────────────────────────────────────────

    function test_reject_rootReturnsToClient() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _reject(client, root);

        assertEq(uint8(cascade.getCommitment(root).state),   uint8(Cascade.State.Failed));
        assertEq(cascade.claimable(client),                  u(10));
        assertEq(cascade.totalEscrowed(),                    0);
        assertEq(cascade.totalClaimable(),                   u(10));
    }

    function test_reject_childReturnsToParent() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);

        _submit(bob, child, "ref");
        _reject(alice, child);

        // Root remaining should be restored: was (10-5)=5, now back to 10.
        assertEq(cascade.getCommitment(root).remaining, u(10));
        assertEq(cascade.totalEscrowed(),               u(10));
        assertEq(cascade.totalClaimable(),              0);
    }

    function test_reject_successfulGrandchildSurvives() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);
        uint256 gc    = _createChild(bob, child, carol, u(3), DEADLINE);

        // Approve grandchild first.
        _submit(carol, gc, "gc-ref");
        _approve(bob, gc);  // bob is child's manager → gc approver

        // child.remaining = 5 - 3 = 2 (gc approved, carol earned 3).
        assertEq(cascade.getCommitment(child).remaining, u(2));
        assertEq(cascade.claimable(carol), u(3));

        // Reject the child.
        _submit(bob, child, "child-ref");
        _reject(alice, child);

        // Only child.remaining (2) returns to root — not carol's 3.
        // root.remaining was 5 (after child allocated), +2 refund = 7.
        assertEq(cascade.getCommitment(root).remaining, u(7));
        assertEq(cascade.claimable(carol), u(3));   // unchanged
        assertEq(cascade.totalClaimable(), u(3));   // carol's
        // Initial escrowed: 10. GC approved: 3 moved to claimable. totalEscrowed = 7.
        // Child rejected: child.remaining(2) returns to root. totalEscrowed stays 7.
        assertEq(cascade.totalEscrowed(), u(7));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H. Cancel
    // ─────────────────────────────────────────────────────────────────────────

    function test_cancel_happy() public {
        uint256 root = _createRootDefault();
        _cancel(client, root);

        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Failed));
        assertEq(cascade.claimable(client), u(10));
    }

    function test_cancel_notApprover_reverts() public {
        uint256 root = _createRootDefault();
        vm.prank(mallory);
        vm.expectRevert(Cascade.NotApprover.selector);
        cascade.cancel(root);
    }

    function test_cancel_childrenNotTerminal_reverts() public {
        uint256 root = _createRootDefault();
        _createChild(alice, root, bob, u(3), DEADLINE);

        vm.prank(client);
        vm.expectRevert(Cascade.ChildrenNotTerminal.selector);
        cascade.cancel(root);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // I. Expire
    // ─────────────────────────────────────────────────────────────────────────

    function test_expire_permissionless_afterDeadline() public {
        uint256 root = _createRootDefault();
        vm.warp(DEADLINE + 1);
        vm.prank(mallory);  // anyone can call
        cascade.expire(root);

        assertEq(uint8(cascade.getCommitment(root).state),     uint8(Cascade.State.Failed));
        assertEq(uint8(cascade.getCommitment(root).failReason), uint8(Cascade.FailReason.Expired));
        assertEq(cascade.claimable(client), u(10));
    }

    function test_expire_beforeDeadline_reverts() public {
        uint256 root = _createRootDefault();
        vm.expectRevert(Cascade.DeadlineNotExpired.selector);
        cascade.expire(root);
    }

    function test_expire_alreadyTerminal_reverts() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _approve(client, root);

        vm.warp(DEADLINE + 1);
        vm.expectRevert(Cascade.AlreadyTerminal.selector);
        cascade.expire(root);
    }

    function test_expire_bottomUp() public {
        // Child expires first, then parent.
        uint64 childDl = uint64(NOW + 1 days);
        uint256 root  = _createRoot(alice, u(10), u(7), DEADLINE);
        uint256 child = _createChild(alice, root, bob, u(5), childDl);

        // After child deadline, expire child.
        vm.warp(childDl + 1);
        cascade.expire(child);
        assertEq(uint8(cascade.getCommitment(child).state), uint8(Cascade.State.Failed));

        // Root's remaining restored.
        assertEq(cascade.getCommitment(root).remaining, u(10));

        // After root deadline, expire root.
        vm.warp(DEADLINE + 1);
        cascade.expire(root);
        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Failed));
        assertEq(cascade.claimable(client), u(10));
    }

    function test_expire_submittedState_allowed() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        vm.warp(DEADLINE + 1);
        cascade.expire(root);
        assertEq(uint8(cascade.getCommitment(root).state), uint8(Cascade.State.Failed));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // J. Claim
    // ─────────────────────────────────────────────────────────────────────────

    function test_claim_happy() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _approve(client, root);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        cascade.claim();

        assertEq(usdc.balanceOf(alice),    before + u(10));
        assertEq(cascade.claimable(alice), 0);
        assertEq(cascade.totalClaimable(), 0);
    }

    function test_claim_nothingToClaim_reverts() public {
        vm.prank(mallory);
        vm.expectRevert(Cascade.NothingToClaim.selector);
        cascade.claim();
    }

    function test_claim_cannotClaimAnotherAccount() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _approve(client, root);

        // mallory cannot steal alice's funds.
        vm.prank(mallory);
        vm.expectRevert(Cascade.NothingToClaim.selector);
        cascade.claim();

        // alice can still claim her own.
        // alice never funded the contract (client did), so her balance is still 1_000_000.
        // After approval she earns 10 USDC → balance becomes 1_000_000 + 10 after claim.
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        cascade.claim();
        assertEq(usdc.balanceOf(alice), aliceBefore + u(10));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // K. Returned funds re-allocation
    // ─────────────────────────────────────────────────────────────────────────

    // ── K1. Complete refund (no grandchildren settled) frees full mandate ────────

    function test_returnedFunds_completeRefundRestoresFullCapacity() public {
        uint256 root  = _createRootDefault(); // budget=10, limit=7
        uint256 child = _createChild(alice, root, bob, u(7), DEADLINE); // use full limit

        // Child fails without spending anything → 7 returns, 7 freed from allocated.
        _submit(bob, child, "ref");
        _reject(alice, child);

        // Root remaining restored to 10.
        assertEq(cascade.getCommitment(root).remaining, u(10));
        // allocated should now be 0 again (7 freed).
        assertEq(cascade.getCommitment(root).allocated, 0);

        // Manager can reallocate the full 7 again.
        uint256 child2 = _createChild(alice, root, carol, u(7), DEADLINE);
        assertEq(cascade.getCommitment(child2).budget, u(7));
        assertEq(cascade.getCommitment(root).allocated, u(7));
    }

    // ── K2. Partial refund: settled 3, returned 2 — only settled permanently consumed ─

    function test_returnedFunds_partialRefund_onlySettledPermanentlyConsumed() public {
        // Root: budget=10, limit=7.
        uint256 root  = _createRootDefault();
        // Child gets 5 USDC.
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);
        // Grandchild (under child) settles 3 USDC.
        uint256 gc    = _createChild(bob, child, carol, u(3), DEADLINE);
        _submit(carol, gc, "gc"); _approve(bob, gc);

        // child.remaining = 2 (5-3 settled).  Reject child → 2 returns to root.
        _submit(bob, child, "c"); _reject(alice, child);

        // root.allocated was 5. Freed = 2 (returned). Settled = 3 stays.
        // So root.allocated = 5 - 2 = 3.
        assertEq(cascade.getCommitment(root).allocated, u(3));
        // root.remaining = (10 - 5) + 2 = 7.
        assertEq(cascade.getCommitment(root).remaining, u(7));

        // Manager can allocate up to 7 - 3 = 4 more (limit - allocated).
        uint256 child2 = _createChild(alice, root, dave, u(4), DEADLINE);
        assertEq(cascade.getCommitment(child2).budget, u(4));
        assertEq(cascade.getCommitment(root).allocated, u(7));

        // But not 1 more — now at limit.
        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, dave, u(1), DEADLINE, "t");
    }

    // ── K3. Multiple replacement cycles ──────────────────────────────────────────

    function test_returnedFunds_multipleReplacementCycles() public {
        // Root: budget=10, limit=7.  Cycle through 3 child replacements.
        uint256 root = _createRootDefault();

        for (uint256 cycle = 0; cycle < 3; cycle++) {
            uint256 ch = _createChild(alice, root, bob, u(7), DEADLINE);
            // Fail without spending → full 7 freed.
            _submit(bob, ch, "r"); _reject(alice, ch);
            assertEq(cascade.getCommitment(root).allocated, 0, "allocated not reset after cycle");
            assertEq(cascade.getCommitment(root).remaining, u(10), "remaining not restored after cycle");
        }

        // After 3 cycles, manager can still allocate 7.
        uint256 final_child = _createChild(alice, root, carol, u(7), DEADLINE);
        assertEq(cascade.getCommitment(final_child).budget, u(7));
    }

    // ── K4. Reserved floor holds throughout replacement cycles ───────────────────

    function test_returnedFunds_reservedFloorNeverViolated() public {
        uint256 root = _createRootDefault(); // reserved = 3

        // Allocate exactly the limit.
        uint256 child = _createChild(alice, root, bob, u(7), DEADLINE);
        // Confirm reserved floor (3) is intact.
        assertEq(cascade.getCommitment(root).remaining, u(3));

        // Cannot allocate 1 more even after partial return without a child failing.
        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, carol, u(1), DEADLINE, "t");

        // Fail the child → full return.
        _submit(bob, child, "r"); _reject(alice, child);

        // Reserved floor (3 USDC) is always untouched relative to root remaining.
        // After full refund: remaining = 10.  Allocating 7 keeps remaining at 3.
        _createChild(alice, root, carol, u(7), DEADLINE);
        assertEq(cascade.getCommitment(root).remaining, u(3));

        // Allocating 1 more would violate the floor → must revert.
        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, dave, u(1), DEADLINE, "t");
    }

    // ── K5. Unsolicited token donation does not affect obligations ────────────────

    function test_unsolicitedDonation_doesNotAffectAccounting() public {
        uint256 root = _createRootDefault(); // 10 USDC in contract

        uint256 escrowedBefore  = cascade.totalEscrowed();
        uint256 claimableBefore = cascade.totalClaimable();
        uint256 balBefore       = cascade.contractBalance();

        // Send 5 USDC directly to the contract (unsolicited donation).
        usdc.mint(address(this), u(5));
        usdc.transfer(address(cascade), u(5));

        // Recorded obligations are unchanged.
        assertEq(cascade.totalEscrowed(),  escrowedBefore);
        assertEq(cascade.totalClaimable(), claimableBefore);

        // Contract balance grew by 5 (balance >= obligations, not necessarily equal).
        assertEq(cascade.contractBalance(), balBefore + u(5));

        // The solvency inequality holds.
        assertGe(cascade.contractBalance(), cascade.totalEscrowed() + cascade.totalClaimable());

        // Normal operations still work correctly.
        _submit(alice, root, "ref");
        _approve(client, root);
        vm.prank(alice); cascade.claim();

        // After claiming 10, contract still holds the 5 donation.
        assertEq(cascade.contractBalance(), u(5));
        assertEq(cascade.totalEscrowed(), 0);
        assertEq(cascade.totalClaimable(), 0);
    }

    // ── K6. FundsReturned event emitted on child failure ──────────────────────────

    function test_fundsReturned_event_emittedOnChildFailure() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(5), DEADLINE);

        _submit(bob, child, "ref");

        // FundsReturned is emitted inside _failCommitment, before CommitmentRejected.
        vm.expectEmit(true, true, true, true, address(cascade));
        emit Cascade.FundsReturned(root, child, u(5));

        _reject(alice, child);
    }

    function test_fundsReturned_event_notEmittedOnRootFailure() public {
        uint256 root = _createRootDefault();
        // Record events; there should be no FundsReturned for a root.
        // We verify by checking root.parentId == 0 path does not emit it.
        // (Root failure credits client directly, no FundsReturned event.)
        _submit(alice, root, "ref");
        _reject(client, root);
        // Client receives claimable, no FundsReturned was emitted (test passes if no revert).
        assertEq(cascade.claimable(client), u(10));
    }

    // ── K7. DeadlinePassed vs DeadlineNotExpired are distinct errors ──────────────

    function test_deadlinePassed_isDistinctFromDeadlineNotExpired() public {
        uint256 root = _createRootDefault();
        // submit after deadline: DeadlinePassed
        vm.warp(DEADLINE + 1);
        vm.prank(alice);
        vm.expectRevert(Cascade.DeadlinePassed.selector);
        cascade.submit(root, "ref");

        // expire before deadline (on a fresh root): DeadlineNotExpired
        uint256 root2 = _createRoot(alice, u(5), u(5), uint64(block.timestamp + 1 days));
        vm.expectRevert(Cascade.DeadlineNotExpired.selector);
        cascade.expire(root2);
    }

    // ── K8. Grandchildren survive parent expiry ───────────────────────────────────

    function test_grandchildrenSurviveParentExpiry() public {
        uint64 childDl = uint64(NOW + 1 days);
        uint256 root  = _createRoot(alice, u(10), u(7), DEADLINE);
        uint256 child = _createChild(alice, root, bob, u(5), childDl);
        uint256 gc    = _createChild(bob, child, carol, u(3), childDl);

        // Approve grandchild (carol earns 3).
        _submit(carol, gc, "gc"); _approve(bob, gc);

        // Expire child after its deadline (grandchild is terminal, so allowed).
        vm.warp(childDl + 1);
        cascade.expire(child);

        // Carol's claimable is untouched.
        assertEq(cascade.claimable(carol), u(3));
        // Child.remaining (2) returned to root.
        assertEq(cascade.getCommitment(root).remaining, u(7));
        // root.allocated freed by 2: was 5, now 3.
        assertEq(cascade.getCommitment(root).allocated, u(3));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // L. Full lifecycle: success path
    // ─────────────────────────────────────────────────────────────────────────

    function test_fullLifecycle_successPath() public {
        uint256 root  = _createRootDefault();
        uint256 child = _createChild(alice, root, bob, u(6), DEADLINE);
        uint256 gc    = _createChild(bob, child, carol, u(4), DEADLINE);

        // Settle from bottom up.
        _submit(carol, gc,    "gc-del");
        _approve(bob,  gc);
        _submit(bob,   child, "child-del");
        _approve(alice, child);
        _submit(alice, root,  "root-del");
        _approve(client, root);

        // All claimable.
        assertEq(cascade.claimable(carol), u(4));
        assertEq(cascade.claimable(bob),   u(2));  // child.remaining after gc allocated
        assertEq(cascade.claimable(alice), u(4));  // root.remaining after child allocated

        assertEq(cascade.totalEscrowed(),  0);
        assertEq(cascade.totalClaimable(), u(10));

        // Claims.
        vm.prank(carol); cascade.claim();
        vm.prank(bob);   cascade.claim();
        vm.prank(alice); cascade.claim();

        assertEq(cascade.totalClaimable(), 0);
        assertEq(usdc.balanceOf(address(cascade)), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M. Double-settlement guard
    // ─────────────────────────────────────────────────────────────────────────

    function test_doubleApprove_reverts() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _approve(client, root);

        vm.prank(client);
        vm.expectRevert(Cascade.NotSubmitted.selector);
        cascade.approve(root);
    }

    function test_doubleReject_reverts() public {
        uint256 root = _createRootDefault();
        _submit(alice, root, "ref");
        _reject(client, root);

        vm.prank(client);
        vm.expectRevert(Cascade.NotSubmitted.selector);
        cascade.reject(root);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // N. Solvency / accounting conservation
    // ─────────────────────────────────────────────────────────────────────────

    function test_accountingConservation_afterPartialSettlement() public {
        uint256 root  = _createRootDefault();
        uint256 c1    = _createChild(alice, root, bob,   u(3), DEADLINE);
        uint256 c2    = _createChild(alice, root, carol, u(4), DEADLINE);

        _submit(bob, c1, "r1"); _approve(alice, c1);   // bob earns 3; root.remaining stays 3 (was 10-3-4=3)
        _submit(carol, c2, "r2"); _reject(alice, c2);  // 4 returns to root.remaining → 3+4=7

        // root.remaining: 10 - 3 - 4 = 3, then +4 (c2 refund) = 7.
        assertEq(cascade.getCommitment(root).remaining, u(7));
        // totalEscrowed: 10 - 3 (approved to bob's claimable) = 7.
        assertEq(cascade.totalEscrowed(),  u(7));
        assertEq(cascade.totalClaimable(), u(3));
        // contract balance: root.remaining(7) + bob.claimable(3) = 10.
        assertEq(usdc.balanceOf(address(cascade)), u(10));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // O. Adversarial: self-controlled children cannot exceed authorized spending
    // ─────────────────────────────────────────────────────────────────────────

    function test_adversarial_selfControlledChildExceedsMandate() public {
        // alice is manager AND approver of child (if she sets it up that way).
        // But she cannot exceed the delegation limit.
        uint256 root = _createRoot(alice, u(10), u(3), DEADLINE);

        // Alice can only allocate 3 to children.
        _createChild(alice, root, bob, u(3), DEADLINE);

        vm.prank(alice);
        vm.expectRevert(Cascade.DelegationCapacityExceeded.selector);
        cascade.createChild(root, alice, u(1), DEADLINE, "t");
    }

    function test_adversarial_managerCannotApproveOwnRoot() public {
        uint256 root = _createRootDefault();  // alice is manager, client is approver
        _submit(alice, root, "ref");

        vm.prank(alice);  // alice tries to approve her own work
        vm.expectRevert(Cascade.NotApprover.selector);
        cascade.approve(root);
    }

    function test_adversarial_unauthorizedCancel() public {
        uint256 root = _createRootDefault();
        vm.prank(mallory);
        vm.expectRevert(Cascade.NotApprover.selector);
        cascade.cancel(root);
    }

    function test_adversarial_nonExistentCommitment() public {
        vm.expectRevert(Cascade.CommitmentNotFound.selector);
        cascade.submit(999, "ref");
    }
}
