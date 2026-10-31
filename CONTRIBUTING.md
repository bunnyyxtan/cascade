# Contributing to Cascade

Thank you for your interest in contributing. This guide covers the ground rules and workflow for contributing code, documentation, and tests.

---

## Before you start

- Read [`docs/development.md`](docs/development.md) to set up your local environment.
- Read [`AGENTS.md`](AGENTS.md) for the accounting invariants and the list of locked files.
- Open an issue before starting significant work so we can discuss the approach.

---

## What we accept

- Bug fixes with a test that reproduces the bug.
- New tests covering untested paths.
- Documentation improvements.
- UI improvements that do not affect financial logic.
- Dependency updates with a clear rationale.

## What requires separate review

Any change to the following requires an explicit discussion before a pull request:

- `contracts/Cascade.sol`
- `src/lib/cascadeAbi.ts`
- `src/lib/configCheck.ts`
- `src/lib/history.ts` (accounting logic)
- `src/hooks/useCascadeWrite.ts`
- `src/lib/outcome.ts`
- Any change to how USDC amounts are calculated or displayed.

---

## Workflow

1. Fork the repository.
2. Create a branch: `feat/short-description` or `fix/short-description`.
3. Make your changes. Keep commits focused — one logical change per commit.
4. Follow [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(explore): add sort-by-deadline option
   fix(workspace): correct remaining balance after child failure
   docs(contracts): clarify allocated semantics
   test(outcome): add fixture for partial settlement
   chore(deps): update vitest to 5.1.0
   ```
5. Run the full check suite locally before pushing:
   ```bash
   bun run check          # lint + typecheck (sequential, no auto-fix)
   bun run check:type     # typography enforcer (sub-12px, inline fontSize, bare literals)
   bun run test           # 369 frontend tests
   bun run contracts:test # 76 Foundry tests
   bun run build          # production build → dist/
   ```
6. Open a pull request against `main`. Fill in the PR template.

---

## Code standards

### TypeScript

- Strict mode is enabled. All new code must typecheck with `tsc --noEmit`.
- No `any` without a comment explaining why.
- Use existing utility types from `src/lib/types.ts` for contract structs.

### React

- One component per file for anything non-trivial.
- New pages go in `src/components/`. New primitives go in `src/components/ui/`.
- Use existing hooks. Do not introduce new direct `useContractRead` calls — add to `src/hooks/useCascade.ts`.

### Solidity

- No changes to `Cascade.sol` without a separate security review.
- New tests must cover the happy path, permission guards, and edge cases.
- Follow the existing NatSpec style.

### CSS

- Use Tailwind utilities or existing CSS classes from `src/index.css`.
- Do not add new CSS files.
- Do not use inline `fontSize` in JSX (checked by `check:type`).
- Minimum font size is 12px (checked by `check:type`).

### Commits

- Use Conventional Commits with a scope.
- Do not fabricate history or backdate commits.

---

## Testing

All pull requests must pass:

- `bun run check` — 0 errors
- `bun run check:type` — 0 violations
- `bun run test` — all tests passing
- `bun run contracts:test` — all 76 Foundry tests passing
- `bun run build` — clean build

New features should include new tests.

---

## Reporting bugs

Open a GitHub issue with:
- A clear description of the bug.
- Steps to reproduce.
- Expected and actual behaviour.
- Network (Arc Testnet), browser, and wallet.

For security vulnerabilities, see [SECURITY.md](SECURITY.md).
