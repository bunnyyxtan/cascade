# Deployment

## Active deployments

| Network | Chain ID | Address | Deploy block | Explorer |
|---------|----------|---------|--------------|---------|
| Arc Mainnet | 5042 | `0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f` | 28,866,425 | [View](https://explorer.arc.io/address/0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f) |
| Arc Testnet | 5042002 | `0xa87371b1127d88df309313ddcaa43b6191fa9a57` | 69,056,151 | [View](https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57) |

Mainnet deploy tx: `0xc6cb7ec3a2d6727da67e991da22790b7df77a154a83ad4ddaf008cc7ff945c21`
Testnet deploy tx: `0x0e07a498c287e26481ea5150968741dea3210e2ad1c0a552bcd15f508fa82a6a`

Runtime codehash (keccak256 of deployed bytecode — identical on both networks):
`0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29`

---

## Compiler settings

```toml
# foundry.toml
solc_version    = "0.8.28"
evm_version     = "cancun"
optimizer       = true
optimizer_runs  = 200
```

---

## Constructor argument

```
usdc = 0x3600000000000000000000000000000000000000
```

This is the Arc Testnet and Mainnet USDC address.

---

## Reproducing the build

```bash
# Install exact Foundry version (match .foundry-version)
foundryup --version $(cat .foundry-version)

# Install Node/Bun dependencies (provides OpenZeppelin)
bun install

# Compile
forge build
```

The compiled artifact is written to `contracts/out/Cascade.sol/Cascade.json`. Its bytecode should produce a keccak256 matching the recorded artifact hash when passed to `keccak256(bytecode.object)`.

---

## Deploying to Arc Testnet

> **Never deploy to mainnet from a shared or automated environment. Review all addresses before signing.**

```bash
# Set environment variables (never commit these)
export PRIVATE_KEY=0x...your_deployer_key...
export USDC_ADDRESS=0x3600000000000000000000000000000000000000
export RPC_URL=https://rpc.testnet.arc.io

# Deploy
forge create contracts/Cascade.sol:Cascade \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$USDC_ADDRESS" \
  --broadcast
```

After deployment, record:
- Contract address → `VITE_CASCADE_ADDRESS` in `.env`
- Deploy block → `VITE_CASCADE_DEPLOY_BLOCK` in `.env`
- Runtime codehash → `VITE_CASCADE_CODEHASH` in `.env`

To retrieve the runtime codehash:

```bash
cast keccak $(cast code <deployed_address> --rpc-url "$RPC_URL")
```

---

## Deterministic deployment (Create2)

`contracts/script/DeployCreate2.s.sol` and `contracts/script/Create2Factory.sol` provide a Create2-based deployment path for a predictable address across networks.

```bash
# Deploy the factory first (one-time per network)
forge create contracts/script/Create2Factory.sol:Create2Factory \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast

# Then deploy Cascade through the factory
FACTORY_ADDRESS=0x... \
CREATE2_SALT=0x$(cast keccak "cascade-v1") \
CREATION_CODE=$(forge inspect Cascade bytecode)... \
forge script contracts/script/DeployCreate2.s.sol \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

---

## Verifying runtime codehash

The frontend verifies the deployed contract on every startup. To confirm manually:

Arc Mainnet:

```bash
RPC_URL=https://rpc.mainnet.arc.io
ADDRESS=0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
echo "Expected: $EXPECTED"
echo "Actual:   $actual"
[ "$actual" = "$EXPECTED" ] && echo "✓ match" || echo "✗ mismatch"
```

Arc Testnet:

```bash
RPC_URL=https://rpc.testnet.arc.io
ADDRESS=0xa87371b1127d88df309313ddcaa43b6191fa9a57
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
echo "Expected: $EXPECTED"
echo "Actual:   $actual"
[ "$actual" = "$EXPECTED" ] && echo "✓ match" || echo "✗ mismatch"
```

---

## Deploying the frontend

The frontend is a static Vite build. Set `.env` production values, then:

```bash
bun run build        # → dist/
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

---

## Deploying a new instance

If you want to deploy your own instance of the Cascade contract to any Arc network:

1. Obtain an independent security audit before handling real funds.
2. Verify all frontend `.env` values (network, contract address, codehash) with great care.
3. Test the full user flow on testnet with the exact same build first.
4. Deploy from your own wallet using the mainnet deployment script (`contracts/script/DeployCascadeMainnet.s.sol`) or a direct `forge create`.
5. Confirm the runtime codehash after deployment.

Arc Mainnet RPC: `https://rpc.mainnet.arc.io`, chain ID: `5042`
Arc Testnet RPC: `https://rpc.testnet.arc.io`, chain ID: `5042002`
