# BRND_OS

BRND_OS is a Next.js App Router dashboard and application surface for BRND brand operations, Season 1/Season 2 leaderboard views, onchain application workflows, and internal intelligence queries. This README is the repository baseline index; implementation details live in the linked audit and guardrail documents.

## Project Baseline Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - current architecture, runtime assumptions, data sources, critical flows, and architectural invariants.
- [ENVIRONMENT.md](./ENVIRONMENT.md) - environment variable audit, local requirements, production-critical variables, and env template guidance.
- [BRAND_IDENTITY_AUDIT.md](./BRAND_IDENTITY_AUDIT.md) - brand identity semantics, source-of-truth boundaries, fallback behavior, and cross-brand merge risks.
- [SCORE_NORMALIZATION_AUDIT.md](./SCORE_NORMALIZATION_AUDIT.md) - S1/S2 score normalization, aggregation paths, materialization/cache behavior, and precision risks.
- [TECHNICAL_RISK_REGISTER.md](./TECHNICAL_RISK_REGISTER.md) - repository-level risk register with evidence, severity, triggers, and mitigation notes.
- [CONTRIBUTING_ARCHITECTURE_RULES.md](./CONTRIBUTING_ARCHITECTURE_RULES.md) - mandatory engineering rules for future contributors and AI coding agents.
- [INVARIANT_TEST_SUMMARY.md](./INVARIANT_TEST_SUMMARY.md) - summary of architecture-critical invariant tests and behavior-preserving test utilities.

## Current BRND_OS Baseline

### Active Stack

- Next.js App Router with React 19 and TypeScript.
- Prisma clients for legacy MySQL, Turso/libSQL write/admin paths, and Postgres indexer reads.
- NextAuth/Auth.js beta with Google and Farcaster-related auth paths.
- Upstash Redis as an optional cache layer.
- Viem/Wagmi/Reown/Coinbase wallet tooling for Base/onchain workflows.
- OpenAI/Gemini/Neynar integrations where configured by environment.

### Current Data Sources

- Legacy MySQL remains present for Season 1, fallback snapshots, and migration-era reads.
- Postgres indexer is used for live Season 2/indexer read-side data.
- Turso/libSQL is used for BRND admin/write-side and materialization paths.
- Static snapshots under `public/data/` remain fallback inputs for brand metadata and S1 data.
- Redis/Upstash is cache-only and should degrade through fallback paths when unavailable.

### Critical Invariants

- Brand identity fields are not interchangeable: indexer `brand.id`, Turso `brands.id`, `onChainId`, slugs, handles, channel/profile references, and IPFS metadata identifiers have different authority levels.
- Existing fallback order must be preserved unless an implementation explicitly updates the relevant audits and tests.
- S1 and S2 scores use different sources and scaling assumptions; 1e18 conversion and all-time aggregation must stay consistent.
- Dashboard authorization must be enforced server-side, not only through UI visibility.
- Intelligence SQL must remain read-oriented, with only the documented `CREATE TEMPORARY TABLE` carve-out.
- Redis and materialized tables are acceleration layers, not canonical sources of truth.

### Commands

Install dependencies and generate Prisma clients before local development:

```bash
npm install
npm run prisma:generate:all
```

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Run the development server:

```bash
npm run dev
```

### Do Not Change Casually

- Brand resolution, canonicalization, fallback order, or identity merge behavior.
- Score normalization, S1/S2 aggregation, leaderboard totals, materialization, or cache invalidation logic.
- Auth middleware, dashboard permission mappings, admin user permission checks, or protected API route enforcement.
- Intelligence SQL validation and query execution boundaries.
- Runtime environment variable names, production-critical env requirements, or feature-disable semantics.
- Onchain publishing/sync behavior and Base RPC handling.

Changes in these areas require human review and focused tests that protect the documented invariants.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Sync brands from Google Sheet

This project can refresh `public/data/brands.json` directly from Google Sheets.

1. Ensure the sheet is accessible (or use a share mode that allows CSV export).
2. Configure optional env vars:
   - `BRANDS_SHEET_ID` (defaults to the current BRND brands sheet)
   - `BRANDS_SHEET_GID` (defaults to `0`)
3. Run:

```bash
npm run brands:sync-sheet
```

The script fetches the sheet as CSV and rebuilds the snapshot used as fallback brand metadata.
