// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {DeployCascadeMainnet} from "../script/DeployCascadeMainnet.s.sol";
import {Cascade} from "../Cascade.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  DeployCascadeMainnetTest
 * @notice Proves the deployment script's preflight checks and post-deploy
 *         assertions are internally consistent against a local (no-broadcast)
 *         environment.
 *
 *         These tests run entirely locally — no broadcast, no real funds,
 *         no network access required.  They exercise every guard in
 *         DeployCascadeMainnet.run():
 *
 *           Preflight:
 *             1. Wrong chain ID           → revert
 *             2. Wrong USDC decimals      → revert
 *             3. Zero deployer balance    → revert
 *
 *           Post-deploy assertions (happy path):
 *             4. usdc() matches the constructor argument
 *             5. nextId() == 1  (Cascade initializes _nextId = 1, not 0)
 *             6. totalEscrowed() == 0
 *             7. totalClaimable() == 0
 *             8. Contract rejects native value (receive/fallback reverts)
 *             9. All checks consolidated in one happy-path test
 */

// ─── Minimal ERC-20 stub ──────────────────────────────────────────────────────
//
// Used to stand in for the real USDC contract at the Arc-canonical address.
// _dec is immutable so its value is inlined into the deployed bytecode —
// vm.etch copies the bytecode to USDC_MAINNET and decimals() returns the
// right value without any additional storage manipulation.

contract StubERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(uint8 dec_) ERC20("Stub USDC", "USDC") {
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) { return _dec; }
}

// ─── Deployment script tests ──────────────────────────────────────────────────

contract DeployCascadeMainnetTest is Test {
    // Deterministic Anvil account 0 — the private key is public knowledge and
    // safe to use in local tests.  Do not use for real funds.
    uint256 constant TEST_PRIVATE_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address constant DEPLOYER =
        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    // Arc Mainnet constants hardcoded in the deployment script
    uint256 constant ARC_MAINNET_CHAIN_ID = 5042;
    address constant USDC_MAINNET = 0x3600000000000000000000000000000000000000;

    // ── helpers ───────────────────────────────────────────────────────────────

    /// Place a StubERC20 at the Arc-canonical USDC address.
    function _etchStubUsdc(uint8 dec_) internal {
        StubERC20 stub = new StubERC20(dec_);
        vm.etch(USDC_MAINNET, address(stub).code);
    }

    /// Standard happy-path setup: correct chain, 6-dec USDC, funded deployer.
    function _happyPath() internal {
        vm.chainId(ARC_MAINNET_CHAIN_ID);
        _etchStubUsdc(6);
        vm.deal(DEPLOYER, 1 ether);
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PRIVATE_KEY));
    }

    /// Run the script and return a typed Cascade reference.
    function _deploy() internal returns (Cascade) {
        DeployCascadeMainnet script = new DeployCascadeMainnet();
        address addr = script.run();
        return Cascade(payable(addr));
    }

    // ── preflight: chain ID ───────────────────────────────────────────────────

    /// Running on the wrong chain (testnet 5042002) must revert.
    function test_preflight_wrongChainId_reverts() public {
        vm.chainId(5042002); // testnet, not mainnet
        _etchStubUsdc(6);
        vm.deal(DEPLOYER, 1 ether);
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PRIVATE_KEY));

        DeployCascadeMainnet script = new DeployCascadeMainnet();
        vm.expectRevert();
        script.run();
    }

    /// Correct chain ID allows the script to proceed.
    function test_preflight_correctChainId_passes() public {
        _happyPath();
        DeployCascadeMainnet script = new DeployCascadeMainnet();
        address addr = script.run();
        assertTrue(addr != address(0), "deploy should succeed on correct chain");
    }

    // ── preflight: USDC decimals ──────────────────────────────────────────────

    /// USDC returning 18 decimals instead of 6 must revert.
    function test_preflight_wrongUsdcDecimals_reverts() public {
        vm.chainId(ARC_MAINNET_CHAIN_ID);
        _etchStubUsdc(18); // wrong
        vm.deal(DEPLOYER, 1 ether);
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PRIVATE_KEY));

        DeployCascadeMainnet script = new DeployCascadeMainnet();
        vm.expectRevert();
        script.run();
    }

    // ── preflight: deployer balance ───────────────────────────────────────────

    /// Zero deployer native balance must revert.
    function test_preflight_zeroDeployerBalance_reverts() public {
        vm.chainId(ARC_MAINNET_CHAIN_ID);
        _etchStubUsdc(6);
        vm.deal(DEPLOYER, 0);
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PRIVATE_KEY));

        DeployCascadeMainnet script = new DeployCascadeMainnet();
        vm.expectRevert();
        script.run();
    }

    // ── post-deploy: usdc() ───────────────────────────────────────────────────

    /// usdc() must return the Arc-canonical USDC address passed at construction.
    function test_postDeploy_usdcAddressMatches() public {
        _happyPath();
        Cascade c = _deploy();
        assertEq(address(c.usdc()), USDC_MAINNET, "usdc() must match USDC_MAINNET");
    }

    // ── post-deploy: nextId() ─────────────────────────────────────────────────

    /**
     * nextId() must return 1 on a fresh deployment.
     *
     * Cascade.sol declares `uint256 private _nextId = 1`.  The first real
     * commitment therefore receives id 1.  Asserting nextId() == 0 would be
     * wrong and was the bug corrected in this commit.
     */
    function test_postDeploy_nextIdIsOne() public {
        _happyPath();
        Cascade c = _deploy();
        assertEq(c.nextId(), 1, "nextId() must be 1 on a fresh deployment");
    }

    // ── post-deploy: accounting state ─────────────────────────────────────────

    /// No USDC is locked on a fresh deployment.
    function test_postDeploy_totalEscrowedIsZero() public {
        _happyPath();
        Cascade c = _deploy();
        assertEq(c.totalEscrowed(), 0, "totalEscrowed must be 0");
    }

    /// No claimable balance exists on a fresh deployment.
    function test_postDeploy_totalClaimableIsZero() public {
        _happyPath();
        Cascade c = _deploy();
        assertEq(c.totalClaimable(), 0, "totalClaimable must be 0");
    }

    // ── post-deploy: native value rejected ───────────────────────────────────

    /// The contract must revert any call that forwards native value.
    function test_postDeploy_nativeValueRejected() public {
        _happyPath();
        Cascade c = _deploy();
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(c).call{value: 1}("");
        assertFalse(ok, "contract must reject native value via receive()");
    }

    // ── happy path: all checks consolidated ──────────────────────────────────

    /**
     * Full happy-path: all three preflight guards pass, deployment succeeds,
     * and every post-deploy state assertion holds in one test.
     */
    function test_happyPath_allChecksPass() public {
        _happyPath();
        Cascade c = _deploy();

        assertTrue(address(c) != address(0),      "non-zero address");
        assertEq(address(c.usdc()), USDC_MAINNET, "usdc()");
        assertEq(c.nextId(),        1,            "nextId() == 1");
        assertEq(c.totalEscrowed(), 0,            "totalEscrowed == 0");
        assertEq(c.totalClaimable(), 0,           "totalClaimable == 0");
    }
}
