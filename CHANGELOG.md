# Changelog

All notable changes to Cascade are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GitHub Actions CI (lint, typecheck, typography check, 369 frontend tests, production build, 76 Foundry tests, secret hygiene).
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.
- `docs/` directory: architecture, contracts, development, deployment, security, plus 15 user-guide articles.
- Content site: `/docs`, `/faq`, `/security`, `/usage-risks`, `/support` routes with full articles.
- Pathname router (`useSyncExternalStore`-based) for content routes, co-existing with hash app routes.
- Responsive site footer (dark band, 4-column link grid, contract address with copy, explorer link).
- Compact docs footer (GitHub edit link, report-a-problem link, small nav links, copyright).
- Contextual "Learn more" links throughout the app (CreateRoot, CommitmentWorkspace, ClaimableView, WalletGate, sidebar).
- Dead-link crawler test (`src/test/linkCrawler.test.tsx`) — crawls all 22 published routes, asserts internal hrefs resolve and external links have `rel="noreferrer"`.
- Vite `rawMarkdown()` plugin for `*.md?raw` imports.
- Search dialog (keyboard-accessible, `/` or Ctrl+K) across all documentation.
- Per-route `<title>`, meta description, and canonical link.

### Changed
- Footer: personal name removed from copyright line; uses `© 2026 Cascade`.
- `OPERATOR` in `src/content/site.ts` is now empty; no personal name published anywhere.
- All `?raw` markdown imports work correctly in dev, test, and production build.

---

## [0.1.0] — 2026-10-25

Initial testnet deployment and complete V1 feature set.

### Contract

- `Cascade.sol`: immutable USDC financial-authority protocol.
  - `createRoot` — fund a root objective with a delegation limit and protected reserve.
  - `createChild` — allocate a portion of a commitment's budget to a child (up to depth 8, 16 children each).
  - `submit` — record a delivery reference string.
  - `approve` / `reject` / `cancel` / `expire` — settlement paths.
  - `claim` — pull USDC from claimable balance.
  - Accounting invariants: `totalEscrowed`, `totalClaimable`, balance floor.
  - 76 Foundry tests: 60 unit, 10 fuzz, 6 invariant.
- Deployed to Arc Testnet at `0xa87371b1127d88df309313ddcaa43b6191fa9a57` (block 69,056,151).

### Frontend

- Landing page with interactive commitment-tree showcase, mandate calculator, process section, FAQ, and footer with live contract address.
- Explore page: full commitment list with search, status filter, sort, and root grouping.
- Commitment workspace: recursive tree with WAI-ARIA roving-tabindex keyboard navigation, inspector panel with Details / Funds / People tabs, all write actions (delegate, submit, approve, reject, cancel, expire, claim).
- Create root: two-step USDC approve + `createRoot` flow with delegation diagram.
- Activity: global event feed with day grouping, block-timestamp resolution, and backfill progress.
- Claimable: per-wallet USDC balance card and claim history.
- Startup config verification: chain ID, runtime codehash, USDC address.
- Design system: Hanken Grotesk + DM Mono, design tokens in `src/styles/tokens.css`.
- 369 frontend tests across 14 suites.
- Typography enforcer (`scripts/check-type.ts`) with SUB12, INLINE, and LITERAL rules.

[Unreleased]: https://github.com/bunnyyxtan/cascade/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bunnyyxtan/cascade/releases/tag/v0.1.0
