# BRND_OS Contributing Architecture Rules

This document defines mandatory engineering rules for BRND_OS contributors and future AI coding agents. It is derived from `ARCHITECTURE.md`, `BRAND_IDENTITY_AUDIT.md`, `SCORE_NORMALIZATION_AUDIT.md`, and `TECHNICAL_RISK_REGISTER.md`.

These are not generic contribution guidelines. They are safety rules for this repository's current migration-sensitive architecture.

## Core Principle

BRND_OS is a transitional multi-source system. Season 2 metrics come from the onchain Postgres indexer. Admin metadata and applications live in Turso. Season 1 points come from MySQL-derived static snapshots. Many flows intentionally combine these sources at read time.

Do not simplify this architecture by assumption. Preserve source boundaries unless a human owner explicitly approves a redesign.

## Hard Rules

### 1. Brand Identity Handling

**Rule:** Treat indexer/onchain `brands.id` as the scoring identity. Treat Turso `brands.id` as local row identity unless `onChainId` proves linkage.

- **Why this exists:** Turso rows and indexer rows are different systems. Current code still supports missing or transitional `onChainId` values.
- **What can break if violated:** Wrong brand metadata can attach to the wrong leaderboard row; onchain update sync can overwrite the wrong Turso row; approved applications may not join to scoring.
- **Safe modification patterns:**
  - Prefer `onChainId` for cross-system joins.
  - Keep route/detail code explicit about which id space it is using.
  - Add read-only diagnostics before changing identity joins.
  - Preserve existing fallback behavior until migration state is verified.
- **Unsafe modification patterns:**
  - Joining Turso `brands.id` to indexer `brands.id` without proving id parity.
  - Using `name`, `channel`, `profile`, or `handle` as durable identity.
  - Adding slug-based identity without defining how it relates to `onChainId`, handle, channel, and profile.

### 2. Source-of-Truth Boundaries

**Rule:** Do not use Turso application/admin metadata as a replacement for Season 2 indexer metrics.

- **Why this exists:** The architecture separates indexer read-side metrics from Turso write-side metadata.
- **What can break if violated:** Leaderboards can use stale or non-authoritative rows; scoring can ignore onchain state; application rows can appear as scored brands.
- **Safe modification patterns:**
  - Read Season 2 votes, users, collectibles, and leaderboard metrics from `prismaIndexer`.
  - Use Turso for operational metadata, applications, categories, admin users, and caches.
  - Use `public/data/s1/*` only as Season 1 baseline input.
- **Unsafe modification patterns:**
  - Calculating Season 2 points from Turso brand rows.
  - Treating MySQL or static snapshots as live Season 2 sources.
  - Updating display metadata fallback order casually.

### 3. S1/S2 Score Normalization

**Rule:** Before touching any field named `points`, `score`, `scoreWeek`, `brand_ids`, `gold_count`, `silver_count`, or `bronze_count`, identify whether it is S1 legacy score, S2 scaled indexer score, live vote aggregation, analytics-only score, or token amount display.

- **Why this exists:** The repo has multiple score systems: S1 integer baselines, S2 1e18-scaled indexer decimals, live weekly `100/50/25`, analytics `3/2/1`, and token amounts.
- **What can break if violated:** Leaderboards can rank incorrectly; all-time totals can double count or shrink; intelligence answers can show raw 1e18 values.
- **Safe modification patterns:**
  - Preserve S1 snapshots as unscaled finite numbers.
  - Normalize S2 indexer decimals consistently before display or aggregation.
  - Keep all-time math explicit as `pointsS1 + pointsS2`.
  - Add tests with representative scaled, unscaled, zero, and large decimal values.
- **Unsafe modification patterns:**
  - Direct `Number(decimal)` on `DECIMAL(78,0)` token/point amounts.
  - Mixing `100/50/25` and `3/2/1` weights without labeling the output.
  - Changing S1 snapshot generation without verifying cutoff dates and downstream all-time totals.

### 4. Fallback Order Preservation

**Rule:** Do not change metadata fallback order unless the change is explicitly reviewed as a product-visible behavior change.

- **Why this exists:** Brand detail can merge Turso, indexer, IPFS, MySQL, and static snapshot data. Order affects visible names, images, categories, and descriptions.
- **What can break if violated:** Users can see different brand identities across pages; stale metadata can override current metadata; IPFS fields can be treated as identity proof.
- **Safe modification patterns:**
  - Document before/after fallback order in the PR.
  - Preserve Turso/indexer/IPFS/MySQL/static roles unless a decision says otherwise.
  - Add screenshots or data snapshots for representative brands.
- **Unsafe modification patterns:**
  - Moving IPFS metadata ahead of verified local fields without review.
  - Treating IPFS metadata contents as canonical brand identity.
  - Removing MySQL/static fallback without checking S1 and metadata use cases.

### 5. Read-Side vs Write-Side Separation

**Rule:** Keep read-side indexer data and write-side Turso data separate in code and naming.

- **Why this exists:** Postgres indexer is an onchain read model. Turso is the operational admin/write database.
- **What can break if violated:** Mutations can target derived read-side assumptions; reads can use unverified local rows; migrations can update the wrong store.
- **Safe modification patterns:**
  - Use `prismaIndexer` for indexer reads.
  - Use `turso` for admin/application/metadata writes.
  - Name new helpers after their source, e.g. `getIndexer...`, `syncTurso...`.
- **Unsafe modification patterns:**
  - Writing code that hides data source behind ambiguous `getBrand` helpers.
  - Mutating Turso based on broad textual matches without user confirmation.
  - Adding write behavior to indexer read paths.

### 6. Cache And Materialization Invalidation

**Rule:** Treat cache and materialized leaderboard code as production data behavior, not harmless performance code.

- **Why this exists:** Turso materialization creates tables/indexes and combines S1/S2 data. Redis caches metadata, intelligence responses, rate limits, and wallet nonces.
- **What can break if violated:** Stale or inconsistent leaderboard data, slow cold starts, runtime DDL failures, incorrect assumptions about unused materializations.
- **Safe modification patterns:**
  - State whether a change affects Redis, Turso materialization, `unstable_cache`, or static JSON.
  - Define invalidation or regeneration expectations.
  - Verify whether a materialization path is actually called before modifying it.
- **Unsafe modification patterns:**
  - Assuming `leaderboard_brands_alltime` is active without tracing callers.
  - Adding runtime DDL in request paths without review.
  - Changing cache keys/TTLs without documenting stale-data effects.

### 7. Auth And Permission Enforcement

**Rule:** Every protected mutation and sensitive read must enforce permissions server-side. Client guards are never sufficient.

- **Why this exists:** Auth is distributed across middleware, NextAuth callbacks, API routes, server actions, and client guards.
- **What can break if violated:** Unauthorized users can mutate admin data, publish onchain actions, query intelligence data, or alter applications.
- **Safe modification patterns:**
  - Use server-side permission helpers for server actions and route handlers.
  - Keep client `PermissionGuard` only as UI affordance.
  - Add negative tests or manual verification for unauthorized access on new protected APIs.
- **Unsafe modification patterns:**
  - Adding a dashboard API route that relies only on middleware.
  - Adding a server action without `requirePermission`, `requireAnyPermission`, or equivalent.
  - Exposing mutation controls based only on client role state.

### 8. Intelligence SQL Safety

**Rule:** Intelligence SQL must remain constrained to safe analytical reads against the indexer. Any expansion requires explicit security review.

- **Why this exists:** Intelligence uses generated SQL and executes through `$queryRawUnsafe` after validation.
- **What can break if violated:** Unsafe SQL execution, expensive queries, schema mutation, data exposure, or wrong score reporting.
- **Safe modification patterns:**
  - Keep prompt, schema docs, validator, and executor policy aligned.
  - Add examples for scaled score conversion in one authoritative place.
  - Test malicious and malformed generated SQL when changing validator behavior.
- **Unsafe modification patterns:**
  - Allowing SQL constructs because the prompt says they will not be generated.
  - Changing `DATABASE_SCHEMA` score guidance without changing `src/lib/gemini.ts`.
  - Increasing query power without timeout/limit review.

### 9. Environment Variable Handling

**Rule:** Do not add, rename, or rely on environment variables without updating `ENVIRONMENT.md` and env templates.

- **Why this exists:** Production behavior depends on conditional env vars for auth, Turso, indexer, MySQL, Redis, Web3, Farcaster, AI, and storage.
- **What can break if violated:** Builds can pass while runtime returns empty data; login can fail; onchain publishing can use wrong RPC/backend; secrets can leak.
- **Safe modification patterns:**
  - Document required/optional status, scope, subsystem, and safe example.
  - Keep public `NEXT_PUBLIC_*` variables non-secret.
  - Validate production-critical variables in diagnostics without exposing values.
- **Unsafe modification patterns:**
  - Adding a secret under `NEXT_PUBLIC_*`.
  - Relying on platform variables without documenting deployment assumptions.
  - Treating `INDEXER_DISABLED`, `MYSQL_DISABLED`, or onchain gating flags as harmless toggles.

### 10. Migration-Safe Changes

**Rule:** Assume the repository is mid-migration unless proven otherwise.

- **Why this exists:** MySQL, Turso, Postgres indexer, static snapshots, IPFS, and transitional Prisma schemas coexist.
- **What can break if violated:** Removing “legacy” paths can break active fallback behavior; updating transitional schemas can mislead future work.
- **Safe modification patterns:**
  - Identify active vs transitional files before changing schemas or scripts.
  - Preserve S1 snapshots and MySQL fallback assumptions unless owner decides otherwise.
  - Treat onchain sync fallback logic as high risk.
- **Unsafe modification patterns:**
  - Deleting legacy-looking files because current pages use S2.
  - Changing schema files without checking which generated client or runtime path uses them.
  - Removing fallback matching without migration/backfill data.

## Before Modifying X, Verify Y

### Brand Identity Or Brand Detail

- Verify whether the input id is Turso `id`, indexer `id`, contract `brandId`, or `onChainId`.
- Verify fallback order in `src/app/dashboard/brands/[id]/page.tsx`.
- Verify whether `onChainId` exists and is populated for affected rows.
- Verify no matching uses `name`, `channel`, `profile`, or `handle` as the only join key.

### Application Approval Or Onchain Create/Update

- Verify server-side permissions.
- Verify wallet address, FID, handle, and metadata hash sources.
- Verify what happens if contract transaction succeeds but DB sync fails.
- Verify whether the flow persists `onChainId`, `metadataHash`, onchain handle, onchain FID, and wallet.

### Scoring Or Leaderboards

- Verify whether the data is S1 or S2.
- Verify whether points are unscaled integers, 1e18-scaled decimals, or already normalized numbers.
- Verify whether the path is live aggregation, indexer materialized table, Turso materialized cache, or static snapshot.
- Verify current weights and ranking tie-breakers.

### Intelligence SQL

- Verify prompt, `DATABASE_SCHEMA`, validator, executor, and UI expectations together.
- Verify score scaling guidance is consistent.
- Verify generated SQL remains bounded by limits and timeout.
- Verify BigInt/Decimal serialization for returned values.

### Environment / Deployment

- Verify whether the subsystem can be disabled and what fallback behavior is.
- Verify production-critical variables are documented in `ENVIRONMENT.md`.
- Verify public variables are safe for browser exposure.
- Verify platform assumptions: Netlify/Vercel/Railway/service-specific values.

### Cache / Materialization

- Verify cache key, TTL, invalidation path, and stale-data tolerance.
- Verify whether materialized table code is actually called.
- Verify runtime DDL impact in serverless execution.
- Verify exactness requirements before storing scores as `REAL` or JS `number`.

## High-Risk Files And Directories

### Brand Identity And Onchain Sync

- `src/app/dashboard/brands/[id]/page.tsx`
- `src/lib/actions/brand-actions.ts`
- `src/components/dashboard/ApplicationsTable.tsx`
- `src/components/dashboard/CreateOnchainPanel.tsx`
- `src/components/dashboard/UpdateOnchainPanel.tsx`
- `src/app/api/admin/indexer/brands/route.ts`
- `src/app/api/admin/sheet/brands/route.ts`
- `src/lib/farcaster/normalize-identifiers.ts`

### Scoring And Leaderboards

- `src/lib/seasons/adapters/indexer.ts`
- `src/lib/seasons/adapters/indexer-brands.ts`
- `src/lib/seasons/adapters/indexer-users.ts`
- `src/lib/seasons/adapters/mysql.ts`
- `src/lib/seasons/s1-baseline.ts`
- `src/lib/dashboard/stats.ts`
- `src/app/api/leaderboard/route.ts`
- `public/data/s1/*`
- `scripts/generate-s1-snapshot.ts`
- `scripts/generate-s1-snapshot-mysql2.ts`

### Intelligence SQL

- `src/app/api/intelligence/query/route.ts`
- `src/lib/gemini.ts`
- `src/lib/intelligence/schema.ts`
- `src/lib/intelligence/sql-validator.ts`
- `src/lib/intelligence/query-executor.ts`

### Auth / Permissions / Environment

- `src/auth.ts`
- `src/middleware.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/auth-checks.ts`
- `src/components/auth/PermissionGuard.tsx`
- `src/lib/turso.ts`
- `src/lib/redis.ts`
- `ENVIRONMENT.md`
- `.env.example`
- `env_template`

### Schema And Migration

- `prisma/schema.prisma`
- `prisma/schema.indexer.prisma`
- `prisma/schema.write.prisma`
- `prisma/schema.admin.prisma`
- `scripts/migrate-turso.ts`
- `scripts/sync-intelligence-schema.ts`

## Areas Requiring Human Review Before Merge

- Any change to brand identity joins, `onChainId`, or sync fallback matching.
- Any change to application approval, direct create, or onchain update flows.
- Any change to score normalization, vote weights, all-time scoring, or S1 snapshot generation.
- Any change to auth callbacks, middleware, permission helpers, or protected API/server-action checks.
- Any change to intelligence SQL validator, executor, schema prompt, or generated SQL examples.
- Any change that adds runtime DDL or changes Turso materialized table schemas.
- Any change that adds or exposes environment variables, especially `NEXT_PUBLIC_*`.
- Any deletion of files that look legacy but are referenced by audit docs or scripts.

## Areas Where Tests Are Mandatory

- Score normalization or leaderboard math changes.
- Identity resolution or cross-source brand lookup changes.
- Application approval and onchain sync changes.
- Permission enforcement changes on routes, APIs, or server actions.
- Intelligence SQL validator/executor changes.
- Environment parsing or feature-disable flag behavior.
- Cache/materialization refresh logic.

Tests can be unit tests, focused integration tests, or documented manual verification when live services are required. For risky data migrations or live onchain flows, tests should be paired with a read-only diagnostic or dry-run plan.

## Agent-Specific Working Rules

- Read the relevant audit document before editing a high-risk area.
- Do not “clean up” duplicated normalization or fallback code unless the task explicitly targets that risk.
- Do not infer that a file is unused from its name; confirm with `rg`.
- Do not remove fallback behavior unless the owner has decided the migration is complete.
- Do not change behavior in the same PR as documentation unless the goal explicitly asks for implementation.
- When uncertain, produce a read-only diagnostic or design note before changing runtime code.
