# Verifying Cascade

The Cascade contract is immutable. The safest way to use it is to verify that the bytecode you are interacting with matches the published source.

## How the app verifies

On every startup, the app:

1. Reads the deployed bytecode via `eth_getCode` from the configured Arc RPC (mainnet or testnet).
2. Computes `keccak256` of that bytecode.
3. Compares the result to the expected codehash stored in `VITE_CASCADE_CODEHASH`.

If the hashes match, the app sets status `ok` and enables writes. If they do not match (or if the RPC call fails), the app shows "Couldn't verify" and gates all write operations.

This check is **fail-closed**: the app refuses to write if it cannot confirm the contract.

## Reproduce manually with cast

Arc Mainnet:

```bash
RPC_URL=https://rpc.mainnet.arc.io
ADDRESS=0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
echo "Expected: $EXPECTED"
echo "Actual:   $actual"
[ "$actual" = "$EXPECTED" ] && echo "match" || echo "mismatch"
```

Arc Testnet:

```bash
RPC_URL=https://rpc.testnet.arc.io
ADDRESS=0xa87371b1127d88df309313ddcaa43b6191fa9a57
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
echo "Expected: $EXPECTED"
echo "Actual:   $actual"
[ "$actual" = "$EXPECTED" ] && echo "match" || echo "mismatch"
```

This requires [Foundry](https://getfoundry.sh) (`cast`). Install it with:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Read events on the explorer

Every commitment state change emits an indexed event. You can read them directly on the block explorer without trusting the app:

1. Open the contract on the appropriate explorer:
   - Mainnet: [explorer.arc.io/address/0x05B07…](https://explorer.arc.io/address/0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f)
   - Testnet: [explorer.testnet.arc.io/address/0xa8737…](https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57)
2. Go to the **Events** tab to see all emitted events in chronological order.
3. Cross-reference commitment IDs, addresses, and amounts with what the app shows.

## Source verification status

The source has not yet been submitted for Blockscout verification. Once verified, the **Code** tab on the explorer will show the Solidity source and allow you to compare it with the [GitHub repository](https://github.com/bunnyyxtan/cascade).

Until then, you can reproduce the build locally:

```bash
git clone https://github.com/bunnyyxtan/cascade
cd cascade
bun install
forge build
cast keccak $(cat contracts/out/Cascade.sol/Cascade.json | jq -r '.deployedBytecode.object')
```

The hash should match `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29`, modulo the metadata hash (which may differ by compiler version).

## Related

- [Networks and addresses](/docs/networks-and-addresses) — full deployment table
- [Security](/security) — audit status and known limitations
- [Limitations](/docs/limitations) — what the contract cannot do
