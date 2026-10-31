// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../contracts/Cascade.sol";

// ─── Shared mock ─────────────────────────────────────────────────────────────

contract AdvMockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// An 18-decimal token — wrong for Cascade but accepted by the constructor.
contract EighteenDecimalToken is ERC20 {
    constructor() ERC20("Wrong Token", "WRONG") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    // decimals() defaults to 18
}

// ═══════════════════════════════════════════════════════════════════════════
// Adversarial test suite
// Tests M-01, M-02, M-03, 16-child limit, L-03, I-03, accounting invariants.
// Cascade.sol is NOT modified.
// ═══════════════════════════════════════════════════════════════════════════

contract CascadeAdversarial is Test {
    AdvMockUSDC internal usdc;
    Cascade     internal cascade;

    address internal client  = makeAddr("client");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");
    address internal dave    = makeAddr("dave");
    address internal mallory = makeAddr("mallory"); // adversary / third party

    uint64 internal constant NOW      = 1_000_000;
    uint64 internal constant ONE_DAY  = 86_400;
    uint64 internal constant DEADLINE = NOW + 7 * ONE_DAY;

    function u(uint256 whole) internal pure returns (uint256) { return whole * 1e6; }

    function setUp() public {
        vm.warp(NOW);
        usdc    = new AdvMockUSDC();
        cascade = new Cascade(address(usdc));

        address[5] memory actors = [client, alice, bob, carol, mallory];
        for (uint256 i; i < actors.length; ++i) {
            usdc.mint(actors[i], u(10_000_000));
            vm.prank(actors[i]);
            usdc.approve(address(cascade), type(uint256).max);
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _root(address mgr, uint256 budget, uint256 limit, uint64 dl)
        internal returns (uint256)
    {
        vm.prank(client);
        return cascade.createRoot(mgr, budget, limit, dl, "Root");
    }

    function _child(address who, uint256 parentId, address mgr, uint256 amt, uint64 dl)
        internal returns (uint256)
    {
        vm.prank(who);
        return cascade.createChild(parentId, mgr, amt, dl, "Child");
    }

    function _submit(address who, uint256 id) internal {
        vm.prank(who);
        cascade.submit(id, "delivery-ref");
    }

    function _approve(address who, uint256 id) internal {
        vm.prank(who);
        cascade.approve(id);
    }

    function _reject(address who, uint256 id) internal {
        vm.prank(who);
        cascade.reject(id);
    }

    function _expire(address who, uint256 id) internal {
        vm.prank(who);
        cascade.expire(id);
    }

    function _claim(address who) internal {
        vm.prank(who);
        cascade.claim();
    }

    function _assertInvariant() internal view {
        uint256 bal       = usdc.balanceOf(address(cascade));
        uint256 escrowed  = cascade.totalEscrowed();
        uint256 claimable = cascade.totalClaimable();
        assertGe(bal, escrowed + claimable, "INVARIANT: balance < escrowed+claimable");
    }

    // =========================================================================
    // M-01: Constructor does not validate chain ID or token address
    // =========================================================================

    /// Proves the constructor accepts a non-USDC 18-decimal token without reverting.
    /// This documents the deployment risk; no revert means a wrong token would
    /// silently misconfigure the contract.
    function test_M01_wrongDecimalToken_accepted() public {
        EighteenDecimalToken wrong = new EighteenDecimalToken();
        // Constructor must NOT revert — it cannot distinguish 18-dec from 6-dec.
        Cascade misconfigured = new Cascade(address(wrong));
        assertEq(address(misconfigured.usdc()), address(wrong));
        // Document: 1 "USDC unit" in this contract is 1e18, not 1e6.
        // Economic values would be silently wrong by a factor of 1e12.
    }

    /// Proves the constructor accepts deployment on the wrong chain (e.g. Ethereum
    /// mainnet chain ID 1) without reverting.
    function test_M01_wrongChainId_accepted() public {
        vm.chainId(1); // simulate Ethereum mainnet
        // No revert expected — chain ID is not checked.
        Cascade onWrongChain = new Cascade(address(usdc));
        assertEq(address(onWrongChain.usdc()), address(usdc));
        vm.chainId(5042002); // restore
    }

    /// A correctly deployed instance functions normally — confirms correct deployment
    /// path has no issues, just no guard against incorrect path.
    function test_M01_correctDeployment_functions_normally() public {
        uint256 id = _root(alice, u(100), u(80), DEADLINE);
        Cascade.Commitment memory c = cascade.getCommitment(id);
        assertEq(c.budget, u(100));
        assertEq(c.delegationLimit, u(80));
        _assertInvariant();
    }

    // =========================================================================
    // M-02: Permissionless expire on Submitted commitments
    // =========================================================================

    /// Core scenario: manager submits in the last second before deadline.
    /// Third party expires in the next block (deadline+1).
    /// Proves it succeeds and accounting is correct.
    function test_M02_thirdParty_expires_submitted_at_deadline() public {
        uint256 budget = u(500);
        uint256 id = _root(alice, budget, budget, DEADLINE);

        // Manager submits 1 second before deadline.
        vm.warp(DEADLINE - 1);
        _submit(alice, id);
        assertEq(uint8(cascade.getCommitment(id).state), uint8(Cascade.State.Submitted));

        // One second passes — deadline crossed.
        vm.warp(DEADLINE + 1);

        // Mallory (unrelated third party, no financial interest) expires it.
        _expire(mallory, id);

        // Commitment is now Failed.
        Cascade.Commitment memory c = cascade.getCommitment(id);
        assertEq(uint8(c.state),      uint8(Cascade.State.Failed));
        assertEq(uint8(c.failReason), uint8(Cascade.FailReason.Expired));
        assertEq(c.remaining,         0);

        // Funds returned to client's claimable (root failure path).
        assertEq(cascade.claimable(client), budget);
        assertEq(cascade.totalClaimable(),  budget);
        assertEq(cascade.totalEscrowed(),   0);
        _assertInvariant();

        // Client can claim.
        uint256 before = usdc.balanceOf(client);
        _claim(client);
        assertEq(usdc.balanceOf(client), before + budget);
        assertEq(cascade.claimable(client), 0);
        _assertInvariant();
    }

    /// Approver acts before deadline — no race possible.
    function test_M02_approver_approves_before_deadline_safe() public {
        uint256 id = _root(alice, u(200), u(200), DEADLINE);

        vm.warp(DEADLINE - 100);
        _submit(alice, id);

        // Approver acts with 100 seconds to spare.
        vm.warp(DEADLINE - 50);
        _approve(client, id);

        assertEq(uint8(cascade.getCommitment(id).state), uint8(Cascade.State.Succeeded));
        assertEq(cascade.claimable(alice), u(200));
        _assertInvariant();
    }

    /// After expiry, approve reverts — double settlement is impossible.
    function test_M02_cannotApprove_afterExpire() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);

        vm.warp(DEADLINE - 1);
        _submit(alice, id);
        vm.warp(DEADLINE + 1);
        _expire(mallory, id);

        vm.prank(client);
        vm.expectRevert(Cascade.NotSubmitted.selector);
        cascade.approve(id);
    }

    /// After approval, expire reverts — double settlement is impossible.
    function test_M02_cannotExpire_afterApprove() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);

        vm.warp(DEADLINE - 100);
        _submit(alice, id);
        _approve(client, id);

        vm.warp(DEADLINE + 1);
        vm.prank(mallory);
        vm.expectRevert(Cascade.AlreadyTerminal.selector);
        cascade.expire(id);
    }

    /// Proves expire cannot be called before deadline.
    function test_M02_cannotExpire_beforeDeadline() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);
        vm.warp(DEADLINE - 1);
        _submit(alice, id);

        // Still 1 second before deadline.
        vm.prank(mallory);
        vm.expectRevert(Cascade.DeadlineNotExpired.selector);
        cascade.expire(id);
    }

    /// Exact boundary: expire fails AT deadline, succeeds at deadline+1.
    function test_M02_expire_boundary_deadline_vs_deadline_plus_one() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);

        // AT deadline (block.timestamp == deadline) → DeadlineNotExpired.
        vm.warp(DEADLINE);
        vm.prank(mallory);
        vm.expectRevert(Cascade.DeadlineNotExpired.selector);
        cascade.expire(id);

        // deadline+1 → success.
        vm.warp(DEADLINE + 1);
        _expire(mallory, id);
        assertEq(uint8(cascade.getCommitment(id).state), uint8(Cascade.State.Failed));
    }

    /// Legitimate use of permissionless expire: unresponsive manager on Active commitment.
    function test_M02_permissionless_expire_active_unresponsive_manager() public {
        uint64 shortDeadline = NOW + 3600; // 1 hour
        uint256 id = _root(alice, u(300), u(300), shortDeadline);

        // Alice (manager) goes unresponsive. Client can't cancel (only approver=client
        // can cancel, and Alice hasn't submitted). After deadline anyone can expire.
        vm.warp(shortDeadline + 1);
        _expire(mallory, id); // permissionless

        assertEq(uint8(cascade.getCommitment(id).state), uint8(Cascade.State.Failed));
        assertEq(cascade.claimable(client), u(300));
        _assertInvariant();
    }

    /// Third party gets no financial benefit from expiring — they just pay gas.
    function test_M02_thirdParty_gains_nothing_from_expiring() public {
        uint256 id = _root(alice, u(1000), u(1000), DEADLINE);
        vm.warp(DEADLINE - 1);
        _submit(alice, id);
        vm.warp(DEADLINE + 1);

        uint256 malloryBefore = usdc.balanceOf(mallory);
        _expire(mallory, id);
        uint256 malloryAfter = usdc.balanceOf(mallory);

        // Mallory gained no USDC.
        assertEq(malloryBefore, malloryAfter);
        // Client got the refund.
        assertEq(cascade.claimable(client), u(1000));
    }

    // =========================================================================
    // M-03: Deep-tree fund lock and bottom-up expiry recovery
    // =========================================================================

    /// Full 8-level deep chain with all managers unresponsive.
    /// Prove every level can be expired bottom-up and all funds return to client.
    function test_M03_maxDepth_chain_fully_recoverable() public {
        // Build 8 managers.
        address[9] memory mgrs;
        mgrs[0] = alice;
        for (uint256 i = 1; i <= 8; i++) {
            mgrs[i] = makeAddr(string(abi.encodePacked("mgr", i)));
        }

        // Root: budget=100, delegationLimit=100, deadline=8 days.
        uint64 rootDl = NOW + 8 * ONE_DAY;
        uint256 budget = u(100);
        uint256 root = _root(mgrs[0], budget, budget, rootDl);

        // Build chain depth 1..8 with strictly decreasing deadlines.
        uint256[9] memory ids;
        ids[0] = root;
        uint256 amt = budget;
        for (uint256 d = 1; d <= 8; d++) {
            // Give each manager funds and approval.
            usdc.mint(mgrs[d], u(1_000_000));
            vm.prank(mgrs[d]);
            usdc.approve(address(cascade), type(uint256).max);

            uint64 dl = rootDl - uint64(d) * 100; // decreasing deadline
            ids[d] = _child(mgrs[d-1], ids[d-1], mgrs[d], amt, dl);
            _assertInvariant();
        }

        // Total escrowed = budget (no new USDC entered).
        assertEq(cascade.totalEscrowed(), budget);

        // All managers unresponsive. Expire bottom-up after deepest deadline.
        // Deepest deadline = rootDl - 8*100.
        vm.warp(rootDl + 1);

        // Expire from depth 8 down to depth 0 (root).
        for (uint256 d = 8; d > 0; d--) {
            _expire(mallory, ids[d]);
            _assertInvariant();
            Cascade.Commitment memory c = cascade.getCommitment(ids[d]);
            assertEq(uint8(c.state), uint8(Cascade.State.Failed));
            assertEq(c.remaining, 0);
        }

        // Now expire root.
        _expire(mallory, ids[0]);
        _assertInvariant();
        assertEq(uint8(cascade.getCommitment(ids[0]).state), uint8(Cascade.State.Failed));

        // All funds return to client's claimable.
        assertEq(cascade.claimable(client), budget);
        assertEq(cascade.totalEscrowed(), 0);
        assertEq(cascade.totalClaimable(), budget);

        // Client claims everything.
        uint256 before = usdc.balanceOf(client);
        _claim(client);
        assertEq(usdc.balanceOf(client), before + budget);
        assertEq(cascade.totalClaimable(), 0);
        assertEq(usdc.balanceOf(address(cascade)), 0);
    }

    /// Cannot expire a parent before its children are terminal.
    function test_M03_cannotExpire_parent_before_children() public {
        uint64 rootDl  = NOW + 7 * ONE_DAY;
        uint64 childDl = rootDl - ONE_DAY;
        uint256 root  = _root(alice, u(100), u(100), rootDl);
        /* uint256 child = */ _child(alice, root, bob, u(50), childDl);

        vm.warp(rootDl + 1);

        // Child is still Active — trying to expire root must revert.
        vm.prank(mallory);
        vm.expectRevert(Cascade.ChildrenNotTerminal.selector);
        cascade.expire(root);
    }

    /// Child deadline cannot exceed parent deadline — enforced at createChild.
    function test_M03_childDeadline_cannotExceed_parentDeadline() public {
        uint256 root = _root(alice, u(100), u(100), DEADLINE);

        vm.prank(alice);
        vm.expectRevert(Cascade.DeadlineExceedsParent.selector);
        cascade.createChild(root, bob, u(50), DEADLINE + 1, "t");
    }

    /// Partial settlement: some grandchildren succeed, child fails.
    /// Accounting of allocated is correct — settled portion stays, unspent is freed.
    function test_M03_partialSettlement_allocatedAccounting() public {
        // Root: budget=100, delegationLimit=100.
        uint256 root  = _root(alice, u(100), u(100), DEADLINE);
        uint256 child = _child(alice, root, bob, u(60), DEADLINE);

        // Bob creates two grandchildren: gc1=40, gc2=15. Keeps 5 unspent.
        uint256 gc1 = _child(bob, child, carol, u(40), DEADLINE);
        uint256 gc2 = _child(bob, child, carol, u(15), DEADLINE);
        // child.remaining = 60 - 40 - 15 = 5

        // gc1 succeeds: carol gets 40.
        _submit(carol, gc1);
        _approve(bob, gc1);
        assertEq(cascade.claimable(carol), u(40));

        // gc2 succeeds: carol gets 15 more.
        _submit(carol, gc2);
        _approve(bob, gc2);
        assertEq(cascade.claimable(carol), u(55));

        // child.remaining = 5 (unspent), state still Active.
        assertEq(cascade.getCommitment(child).remaining, u(5));

        // Approver (alice) rejects child — unspent 5 returns to root.remaining.
        // root.allocated should decrease by 5 (the unspent portion).
        _submit(bob, child);
        _reject(alice, child);

        Cascade.Commitment memory r = cascade.getCommitment(root);
        // allocated was 60 (whole child budget), freed by refund of 5 → now 55.
        assertEq(r.allocated,  u(55));
        assertEq(r.remaining,  u(45)); // 100 - 60 + 5 = 45

        _assertInvariant();
    }

    /// Verify that the root deadline is the hard outer bound for the entire tree.
    function test_M03_rootDeadline_bounds_entire_tree() public {
        uint64 rootDl = NOW + 365 * ONE_DAY; // 1-year root
        uint256 root  = _root(alice, u(1000), u(1000), rootDl);

        // Child at 364 days.
        uint64 childDl = NOW + 364 * ONE_DAY;
        uint256 child = _child(alice, root, bob, u(500), childDl);

        // Grandchild at 363 days.
        uint64 gcDl = NOW + 363 * ONE_DAY;
        uint256 gc = _child(bob, child, carol, u(250), gcDl);

        // After the full year, all three can be expired bottom-up by anyone.
        vm.warp(rootDl + 1);
        _expire(mallory, gc);
        _expire(mallory, child);
        _expire(mallory, root);

        assertEq(cascade.claimable(client), u(1000));
        assertEq(cascade.totalEscrowed(), 0);
        _assertInvariant();
    }

    /// Minimum deadline: 1 second in the future is accepted (no minimum guard).
    /// Documents that very short deadlines are possible — design by intent.
    function test_M03_minimumDeadline_oneSecond_accepted() public {
        uint64 tinyDl = uint64(block.timestamp) + 1;
        uint256 id = _root(alice, u(100), u(100), tinyDl);
        assertEq(cascade.getCommitment(id).deadline, tinyDl);
    }

    // =========================================================================
    // 16-child limit — failed children do not free slots
    // =========================================================================

    /// Core finding: failed child does not decrement childCount.
    /// After 16 children (some failed), a 17th is rejected even if slots "look free".
    function test_16child_failedChild_doesNotFreeSlot() public {
        // Root with enough budget for 16 children + more.
        uint256 root = _root(alice, u(200), u(200), DEADLINE);

        uint256 first = _child(alice, root, bob, u(1), DEADLINE);

        // Cancel first child (Active → Failed).
        // first child's approver = root's manager = alice.
        vm.prank(alice);
        cascade.cancel(first);

        Cascade.Commitment memory r = cascade.getCommitment(root);
        assertEq(r.childCount, 1);         // count NOT decremented
        assertEq(r.allocated, 0);           // allocated freed (1 USDC returned)
        assertEq(r.remaining, u(200));      // budget fully restored

        // Fill the remaining 15 slots.
        for (uint256 i = 0; i < 15; i++) {
            _child(alice, root, bob, u(1), DEADLINE);
        }
        assertEq(cascade.getCommitment(root).childCount, 16);

        // 17th attempt reverts — no slot available even though first child failed.
        vm.prank(alice);
        vm.expectRevert(Cascade.MaxChildrenExceeded.selector);
        cascade.createChild(root, bob, u(1), DEADLINE, "t");
    }

    /// All 16 children succeed — root accounting and final claim are correct.
    function test_16child_allSucceed_fullPayout() public {
        uint256 root = _root(alice, u(160), u(160), DEADLINE);
        uint256[16] memory kids;

        // Create 16 children of u(10) each.
        for (uint256 i = 0; i < 16; i++) {
            kids[i] = _child(alice, root, bob, u(10), DEADLINE);
        }

        // Bob submits and alice approves each child.
        for (uint256 i = 0; i < 16; i++) {
            _submit(bob, kids[i]);
            _approve(alice, kids[i]);
        }

        assertEq(cascade.claimable(bob), u(160));
        assertEq(cascade.totalEscrowed(), 0);
        _assertInvariant();

        // Bob claims.
        _claim(bob);
        assertEq(cascade.claimable(bob), 0);
        assertEq(usdc.balanceOf(address(cascade)), 0);
    }

    /// 15 children succeed; 1 child's manager is unresponsive (lost key).
    /// After deadline, the locked child is expired, funds return to root,
    /// root is expired, and client recovers everything.
    function test_16child_oneBlocked_clientRecovery() public {
        uint64 rootDl  = NOW + 7 * ONE_DAY;
        uint256 root   = _root(alice, u(160), u(160), rootDl);
        address ghost  = makeAddr("ghost"); // unresponsive manager

        uint256[15] memory kids;
        for (uint256 i = 0; i < 15; i++) {
            kids[i] = _child(alice, root, bob, u(10), rootDl);
        }
        uint256 blocked = _child(alice, root, ghost, u(10), rootDl);

        // 15 children succeed.
        for (uint256 i = 0; i < 15; i++) {
            _submit(bob, kids[i]);
            _approve(alice, kids[i]);
        }
        assertEq(cascade.claimable(bob), u(150));

        // ghost is unresponsive. After root deadline, expire blocked child then root.
        vm.warp(rootDl + 1);

        _expire(mallory, blocked); // returns 10 USDC to root.remaining
        Cascade.Commitment memory r = cascade.getCommitment(root);
        assertEq(r.remaining, u(10)); // blocked child's budget returned

        // Root is now Active with 10 remaining but all children terminal.
        // Expire root — returns 10 USDC to client.
        _expire(mallory, root);

        assertEq(cascade.claimable(client), u(10));
        assertEq(cascade.totalEscrowed(), 0);
        _assertInvariant();

        // Both parties claim.
        _claim(bob);
        _claim(client);
        assertEq(usdc.balanceOf(address(cascade)), 0);
    }

    // =========================================================================
    // L-03: approve does not re-check children (safe by construction)
    // =========================================================================

    /// submit requires children terminal → approve is safe without re-check.
    function test_L03_submit_gated_by_terminal_children() public {
        uint256 root  = _root(alice, u(50), u(50), DEADLINE);
        uint256 child = _child(alice, root, bob, u(20), DEADLINE);
        /* uint256 gc = */ _child(bob, child, carol, u(10), DEADLINE);

        // child has active grandchild → cannot submit.
        vm.prank(bob);
        vm.expectRevert(Cascade.ChildrenNotTerminal.selector);
        cascade.submit(child, "ref");
    }

    /// Full submit+approve cycle — invariant holds throughout.
    function test_L03_submit_then_approve_invariant() public {
        uint256 root  = _root(alice, u(100), u(100), DEADLINE);
        uint256 child = _child(alice, root, bob, u(60), DEADLINE);

        _submit(bob, child);
        _assertInvariant();
        _approve(alice, child);
        _assertInvariant();

        assertEq(cascade.claimable(bob), u(60));
        assertEq(cascade.getCommitment(root).remaining, u(40));
    }

    // =========================================================================
    // I-03: root failure emits no FundsReturned event
    // =========================================================================

    /// Root rejection emits CommitmentRejected but NOT FundsReturned.
    function test_I03_rootRejection_noFundsReturnedEvent() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);
        _submit(alice, id);

        // Expect CommitmentRejected but NOT FundsReturned.
        vm.expectEmit(true, true, false, false);
        emit Cascade.CommitmentRejected(id, client);

        // FundsReturned would require parentId > 0; root has parentId = 0,
        // so _failCommitment takes the root branch and skips FundsReturned.
        vm.prank(client);
        cascade.reject(id);

        assertEq(cascade.claimable(client), u(100));
    }

    /// Non-root rejection emits FundsReturned.
    function test_I03_childRejection_emits_FundsReturned() public {
        uint256 root  = _root(alice, u(100), u(100), DEADLINE);
        uint256 child = _child(alice, root, bob, u(40), DEADLINE);
        _submit(bob, child);

        vm.expectEmit(true, true, false, true);
        emit Cascade.FundsReturned(root, child, u(40));

        vm.prank(alice);
        cascade.reject(child);
    }

    // =========================================================================
    // Accounting invariant — multi-root, mixed operations
    // =========================================================================

    /// Multiple roots, interleaved approve/reject/expire/claim.
    /// Invariant holds at every step.
    function test_accounting_multiRoot_mixedOperations() public {
        uint256 r1 = _root(alice, u(300), u(300), DEADLINE);
        uint256 r2 = _root(bob,   u(200), u(200), DEADLINE);

        // r1: create child, approve.
        uint256 c1 = _child(alice, r1, carol, u(100), DEADLINE);
        _submit(carol, c1);
        _approve(alice, c1);
        _assertInvariant();

        // r2: create child, reject.
        uint256 c2 = _child(bob, r2, carol, u(80), DEADLINE);
        _submit(carol, c2);
        _reject(bob, c2);
        _assertInvariant();

        // carol claims her payout from c1.
        _claim(carol);
        _assertInvariant();

        // After deadline, expire both roots (r2 and r1 both still have remaining balance).
        // r1.remaining = 300 - 100 (child succeeded) = 200.
        // r2.remaining = 200 - 80 (child rejected, funds returned) = 200.
        vm.warp(DEADLINE + 1);
        _expire(mallory, r2); // c2 already Failed; r2 children terminal
        _assertInvariant();
        _expire(mallory, r1); // c1 already Succeeded; r1 children terminal
        _assertInvariant();

        // client receives r1 refund (200) + r2 refund (200) = 400 total claimable.
        assertEq(cascade.claimable(client), u(400));

        // Claim all.
        _claim(client);
        assertEq(cascade.totalEscrowed(), 0);
        assertEq(cascade.totalClaimable(), 0);
        assertEq(usdc.balanceOf(address(cascade)), 0);
    }

    /// Unsolicited ERC-20 transfer into contract ("donation") does not break invariant.
    function test_accounting_donation_doesNotBreak() public {
        uint256 id = _root(alice, u(100), u(100), DEADLINE);
        _assertInvariant();

        // Someone transfers 50 USDC directly to the contract.
        vm.prank(carol);
        usdc.transfer(address(cascade), u(50));

        // Invariant: balance (150) >= escrowed (100) + claimable (0).
        _assertInvariant();

        // Normal operations still work.
        _submit(alice, id);
        _approve(client, id);
        _assertInvariant();

        // alice's claimable = 100 (from approve). Donated 50 is in contract on top.
        assertEq(cascade.claimable(alice), u(100));
        assertEq(cascade.totalClaimable(), u(100));
        assertEq(usdc.balanceOf(address(cascade)), u(150)); // 100 claimable + 50 donated

        // Alice claims her 100. The donated 50 remains — no one can take it.
        _claim(alice);
        assertEq(usdc.balanceOf(address(cascade)), u(50));
        assertEq(cascade.totalEscrowed(), 0);
        assertEq(cascade.totalClaimable(), 0);
        // Donated USDC is permanently locked in the contract — documented design property.
        _assertInvariant();
    }
}
