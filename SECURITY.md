# Security policy

## Supported versions

Cascade V1 is currently deployed on Arc Testnet only. There is no mainnet deployment.

| Version | Status |
|---------|--------|
| v0.1.x (testnet) | Active development |

---

## Scope

In scope for vulnerability reports:

- `contracts/Cascade.sol` — the deployed smart contract
- `src/` — the React frontend, including wallet connection, transaction flows, and config verification
- Any logic that could cause loss of user funds, incorrect accounting, or bypass of permission checks

Out of scope:

- Third-party dependencies (report to the dependency maintainer directly)
- Arc network infrastructure
- ConnectKit / wagmi / viem internals
- Theoretical attacks that require physical access to a user's device

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, please report it responsibly:

1. Open a [GitHub Security Advisory](https://github.com/bunnyyxtan/cascade/security/advisories/new) through the repository's Security tab.

2. Include in your report:
   - A clear description of the vulnerability.
   - Steps to reproduce or a proof-of-concept.
   - The potential impact (e.g. fund loss, permission bypass, incorrect accounting).
   - The affected component(s) and version.

3. We will acknowledge receipt and aim to respond with an assessment within 7 days.

---

## Disclosure policy

We follow coordinated disclosure. We ask that you:

- Give us reasonable time to investigate and patch before public disclosure.
- Not exploit the vulnerability on mainnet or against real user funds.
- Not disclose the details publicly until a fix has been released or we have agreed on a disclosure timeline.

---

## Audit status

Cascade V1 has not undergone a professional smart contract security audit. It is deployed on testnet for evaluation only. **Do not use on mainnet with real funds before an independent audit is completed.**
