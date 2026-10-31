# Networks and addresses

## Mainnet (active deployment)

| Item | Value |
|------|-------|
| Network | Arc Mainnet |
| Chain ID | `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | [explorer.arc.io](https://explorer.arc.io) (Blockscout) |
| Cascade contract | `0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| USDC decimals | 6 (ERC-20 view) |
| Deploy block | 28,866,425 (31 Oct 2026) |
| Deploy tx | `0xc6cb7ec3a2d6727da67e991da22790b7df77a154a83ad4ddaf008cc7ff945c21` |
| Runtime codehash | `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29` |
| Build | solc 0.8.28, Cancun EVM, optimizer 200 |
| Explorer source verification | Not yet submitted |

## Testnet (evaluation deployment)

| Item | Value |
|------|-------|
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | [explorer.testnet.arc.io](https://explorer.testnet.arc.io) (Blockscout) |
| Cascade contract | `0xa87371b1127d88df309313ddcaa43b6191fa9a57` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| USDC decimals | 6 (ERC-20 view) |
| Deploy block | 69,056,151 (25 Oct 2026) |
| Deploy tx | `0x0e07a498c287e26481ea5150968741dea3210e2ad1c0a552bcd15f508fa82a6a` |
| Runtime codehash | `0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29` |
| Build | solc 0.8.28, Cancun EVM, optimizer 200 |
| Explorer source verification | Not yet submitted |

Both deployments use the same compiled bytecode (runtime codehash is identical).

## A note on USDC on Arc

On Arc (both mainnet and testnet), USDC is the native gas token as well as an ERC-20. This means one pool of tokens is exposed two ways:

- **ERC-20 view** — the address `0x3600000000000000000000000000000000000000`, 6 decimals. This is what Cascade uses for all escrow operations.
- **Native view** — the balance your wallet uses for gas, shown with 18 decimals internally.

Your wallet and the Cascade app both work with the ERC-20 view. You do not need a separate "gas token" — the same USDC covers both gas fees and funding.

## Verifying the contract

The app verifies on startup that the deployed bytecode matches the expected codehash. You can reproduce this check manually:

Mainnet:

```bash
RPC_URL=https://rpc.mainnet.arc.io
ADDRESS=0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
[ "$actual" = "$EXPECTED" ] && echo "match" || echo "mismatch"
```

Testnet:

```bash
RPC_URL=https://rpc.testnet.arc.io
ADDRESS=0xa87371b1127d88df309313ddcaa43b6191fa9a57
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
[ "$actual" = "$EXPECTED" ] && echo "match" || echo "mismatch"
```

See [Verifying Cascade](/docs/verifying-cascade) for a full walkthrough.

## Related

- [Verifying Cascade](/docs/verifying-cascade) — reproduce the codehash and understand the startup check
- [Quick start](/docs/quick-start) — getting started on Arc Mainnet or Arc Testnet
