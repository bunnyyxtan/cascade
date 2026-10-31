// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Cascade} from "../Cascade.sol";

/**
 * @title  DeployCascadeMainnet
 * @notice Forge deployment script for Cascade V1 on Arc Mainnet (chain ID 5042).
 *
 *         PREFLIGHT CHECKS (enforced at runtime, not just comments):
 *         1. Chain ID must be 5042 (Arc Mainnet).
 *         2. USDC_ADDRESS must be 0x3600000000000000000000000000000000000000.
 *         3. USDC must respond to decimals() with 6.
 *         4. Deployer balance must be > 0 (has USDC for gas).
 *
 *         HOW TO RUN (outside Arc Studio, on your own machine):
 *
 *         1. Install Foundry: https://getfoundry.sh
 *         2. Set environment variables:
 *
 *              export PRIVATE_KEY=0x<your_deployer_private_key>
 *              export RPC_URL=https://rpc.mainnet.arc.io
 *
 *         3. Dry-run (no broadcast, checks only):
 *
 *              forge script contracts/script/DeployCascadeMainnet.s.sol \
 *                --rpc-url $RPC_URL \
 *                --private-key $PRIVATE_KEY \
 *                -vvvv
 *
 *         4. Broadcast (real transaction, spends USDC gas):
 *
 *              forge script contracts/script/DeployCascadeMainnet.s.sol \
 *                --rpc-url $RPC_URL \
 *                --private-key $PRIVATE_KEY \
 *                --broadcast \
 *                -vvvv
 *
 *         5. Record the output:
 *            - Deployed contract address (logged as "Cascade deployed at")
 *            - Transaction hash (in broadcast/arc_mainnet/5042/run-latest.json)
 *            - Deployment block
 *
 *         SECURITY NOTES:
 *         - Never paste PRIVATE_KEY into chat or commit it to any file.
 *         - The deployer address becomes no one special: Cascade has no owner.
 *         - The contract is immutable. Verify the source before broadcasting.
 *         - This contract has NOT been audited by an independent security firm.
 */
contract DeployCascadeMainnet is Script {
    // Arc Mainnet constants — verified live against rpc.mainnet.arc.io
    uint256 constant EXPECTED_CHAIN_ID   = 5042;
    address constant USDC_ADDRESS        = 0x3600000000000000000000000000000000000000;
    uint8   constant EXPECTED_DECIMALS   = 6;

    function run() external returns (address cascade) {
        // ── Preflight: chain ID ──────────────────────────────────────────────────
        require(
            block.chainid == EXPECTED_CHAIN_ID,
            string(abi.encodePacked(
                "Wrong chain. Expected 5042 (Arc Mainnet), got ",
                _uint2str(block.chainid)
            ))
        );

        // ── Preflight: USDC decimals ─────────────────────────────────────────────
        (bool ok, bytes memory data) = USDC_ADDRESS.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(ok && data.length == 32, "USDC decimals() call failed");
        uint8 decimals = abi.decode(data, (uint8));
        require(
            decimals == EXPECTED_DECIMALS,
            string(abi.encodePacked(
                "USDC decimals mismatch. Expected 6, got ",
                _uint2str(decimals)
            ))
        );

        // ── Preflight: deployer has a balance ────────────────────────────────────
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        require(deployer.balance > 0, "Deployer has no USDC gas balance");

        // ── Deploy ───────────────────────────────────────────────────────────────
        console.log("Chain ID:       ", block.chainid);
        console.log("USDC address:   ", USDC_ADDRESS);
        console.log("USDC decimals:  ", decimals);
        console.log("Deployer:       ", deployer);
        console.log("Deployer balance (native, 18-dec units):", deployer.balance);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        cascade = address(new Cascade(USDC_ADDRESS));
        vm.stopBroadcast();

        console.log("Cascade deployed at:", cascade);

        // ── Post-deploy verification ─────────────────────────────────────────────
        // Read usdc() back from the deployed contract
        (bool ok2, bytes memory data2) = cascade.staticcall(
            abi.encodeWithSignature("usdc()")
        );
        require(ok2 && data2.length == 32, "usdc() read failed");
        address deployedUsdc = abi.decode(data2, (address));
        require(
            deployedUsdc == USDC_ADDRESS,
            "usdc() mismatch after deployment"
        );
        console.log("usdc() verification: PASS (", deployedUsdc, ")");

        // Read nextId() — must be 0 on a fresh deployment
        (bool ok3, bytes memory data3) = cascade.staticcall(
            abi.encodeWithSignature("nextId()")
        );
        require(ok3 && data3.length == 32, "nextId() read failed");
        uint256 nextId = abi.decode(data3, (uint256));
        require(nextId == 0, "nextId() must be 0 on fresh deployment");
        console.log("nextId() verification: PASS (", nextId, ")");

        console.log("");
        console.log("=== RECORD THESE VALUES ===");
        console.log("VITE_NETWORK=mainnet");
        console.log("VITE_CASCADE_ADDRESS=", cascade);
        console.log("(set VITE_CASCADE_DEPLOY_BLOCK to the block number from the receipt)");
        console.log("(set VITE_CASCADE_CODEHASH to keccak256 of the deployed runtime bytecode)");
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 n = v;
        uint256 len;
        while (n != 0) { len++; n /= 10; }
        bytes memory buf = new bytes(len);
        n = v;
        for (uint256 i = len; i > 0; i--) {
            buf[i - 1] = bytes1(uint8(48 + n % 10));
            n /= 10;
        }
        return string(buf);
    }
}
