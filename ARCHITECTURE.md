# BRND_OS Architecture

This document describes the current architecture observed in this repository. It prioritizes implementation files over older planning documents. It does not define future architecture.

## 1. High-Level System Overview

### Observed facts

- BRND_OS is a Next.js admin/dashboard application for BRND operations.
- The primary runtime is a Next.js App Router application under `src/app`.
- The app includes authenticated dashboard views for:
  - onchain Season 2 dashboard data
  - brands
  - users
  - collectibles
  - pending applications
  - admin access control
  - AI-assisted intelligence queries
- The root page redirects authenticated users to `/dashboard`; unauthenticated users see the login form.
- Dashboard routes are protected by `src/middleware.ts` and by route/component-level permission checks.
- Several dashboard sections use server components and direct server data fetching, especially the main dashboard and leaderboard-related views.

### Inferences

- The application is currently in a migration/transition state from a legacy MySQL-backed BRND system toward an onchain/indexer-backed Season 2 system.
- Turso/libSQL acts as the current operational write-side store for admin-managed metadata and materializations, while the Postgres indexer acts as the current onchain read-side source.

### Current deployment/runtime assumptions

Observed:

- `netlify.toml` configures Netlify with `@netlify/plugin-nextjs`, Node 20, and a build command that generates Prisma clients and runs `check:dashboard-permissions`.
- `netlify.toml` sets `INDEXER_DISABLED = "true"` in build environment.
- `next.config.ts` enables standalone output only when `process.env.NETLIFY` is present.
- `next.config.ts` externalizes Prisma packages and aliases optional wallet dependencies for bundling compatibility.

Uncertainty:

- The repository contains Netlify config, but environment variables and docs also reference Vercel-style and Railway-hosted services. The exact production topology cannot be fully determined from the repo alone.

## 2. Technology Stack

| Area | Observed implementation |
| --- | --- |
| Framework | Next.js 16, React 19, App Router, React Server Components |
| Language | TypeScript with `strict: true` |
| Styling/UI | Tailwind CSS v4, shadcn-style primitives in `src/components/ui`, lucide-react icons, local `DrukWide` font |
| Auth | NextAuth v5 beta with Google and Farcaster/SIWE credentials |
| i18n | `next-intl`, messages in `messages/en.json` and `messages/es.json` |
| Legacy DB | MySQL via default Prisma client from `prisma/schema.prisma` |
| Onchain read DB | Postgres indexer via generated `@prisma/client-indexer` from `prisma/schema.indexer.prisma` |
| Operational DB | Turso/libSQL through `@libsql/client` in `src/lib/turso.ts` and related modules |
| Caching | Upstash Redis REST client in `src/lib/redis.ts`, plus Turso materialized tables and static JSON snapshots |
| Web3 | wagmi, viem, Reown/AppKit, Base chain contracts in `src/config` |
| AI/intelligence | Gemini via `@google/generative-ai`; OpenAI helper exists in `src/lib/openai.ts` |
| Charts/export | Recharts and custom export routes/components |
| Scripts/runtime | `tsx`, Prisma generate scripts, snapshot generation scripts, Turso migration scripts |

## 3. Data Source Architecture

### Observed data sources

| Source | Role observed in code | Primary files |
| --- | --- | --- |
| MySQL | Legacy Season 1 data, legacy brand/user/vote schema, fallback metadata, Farcaster cache schema | `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/seasons/adapters/mysql.ts` |
| Postgres indexer | Season 2 onchain read-side data: brands, votes, users, leaderboards, collectibles | `prisma/schema.indexer.prisma`, `src/lib/prisma-indexer.ts`, `src/lib/seasons/adapters/indexer*.ts` |
| Turso/libSQL | Operational write-side/admin DB: brands metadata, applications, categories, admin users, metrics, Farcaster cache, materialized leaderboards | `src/lib/turso.ts`, `src/lib/turso-allowlist.ts`, `scripts/migrate-turso.ts`, `src/lib/auth/admin-user-server.ts` |
| Static JSON | Fallback brand metadata and Season 1 baseline snapshots | `public/data/brands.json`, `public/data/s1/*`, `src/lib/seasons/s1-baseline.ts` |
| Redis/Upstash | Distributed cache for brand/user metadata, dashboard stats, recent votes, intelligence results, locks | `src/lib/redis.ts`, `src/lib/seasons/enrichment/brands.ts`, `src/lib/seasons/enrichment/users.ts` |

### Read-side vs write-side

Observed:

- Season 2 read-side metrics come from the Postgres indexer.
- Write-side brand metadata and application review workflows use Turso.
- Season 1 baselines are read from static JSON snapshots generated from legacy MySQL.
- Some views combine multiple sources at render time.

Inference:

- The repo currently treats onchain/indexer data as authoritative for Season 2 activity and metrics, but not necessarily for all display metadata.

### Known synchronization boundaries

Observed:

- `/apply` writes pending brand rows to Turso with `banned = 1`.
- `/dashboard/applications` reads pending Turso rows, prepares metadata, triggers onchain actions, then syncs DB state.
- Brand detail resolution combines Turso metadata, indexer data, IPFS metadata, and MySQL fallback.
- `public/data/brands.json` can be regenerated from Google Sheets or MySQL scripts.
- `public/data/s1/*` snapshots are generated from MySQL and then read by Season 2 aggregate views.

## 4. Critical Flows

### Brand listing

Observed:

1. `/dashboard/brands` renders `BrandsTableS2`.
2. `BrandsTableS2` calls `getIndexerBrands`.
3. `getIndexerBrands` reads indexer brand/leaderboard rows.
4. For all-time points sorting, it combines:
   - S2 indexer points
   - S1 scores from `public/data/s1/brands-score.json`
5. Brand metadata is enriched through `getBrandsMetadata`.
6. `getBrandsMetadata` checks Redis, then MySQL, then static `public/data/brands.json`.

Primary files:

- `src/app/dashboard/brands/page.tsx`
- `src/components/dashboard/BrandsTableS2.tsx`
- `src/lib/seasons/adapters/indexer-brands.ts`
- `src/lib/seasons/enrichment/brands.ts`

### Brand detail resolution

Observed:

Brand detail reads and merges data in this approximate order:

1. Turso `brands` row for metadata.
2. Indexer brand/leaderboard metrics.
3. Indexer metadata hash.
4. Onchain contract metadata hash fallback.
5. IPFS metadata fallback when local metadata is incomplete.
6. MySQL fallback for missing description/category when enabled.

Primary file:

- `src/app/dashboard/brands/[id]/page.tsx`

### Season scoring

Observed:

- `SeasonRegistry` statically defines Season 1 as MySQL and Season 2 as indexer.
- Season 2 start is hardcoded as `2025-12-12T13:13:00.000Z`.
- Season 1 start is hardcoded as `2024-01-01T00:00:00.000Z` with a TODO to confirm the real date.
- Live weekly aggregation assigns:
  - gold: 100 points
  - silver: 50 points
  - bronze: 25 points
- Indexer point values are normalized from EVM-scale decimals in several adapter files.

Primary files:

- `src/lib/seasons/registry.ts`
- `src/lib/seasons/adapters/indexer.ts`
- `src/lib/seasons/adapters/indexer-brands.ts`
- `src/lib/seasons/adapters/indexer-users.ts`
- `src/lib/seasons/s1-baseline.ts`

### Leaderboards

Observed:

- Active-season leaderboard helpers route through `getActiveAdapter`.
- Season 2 leaderboard data primarily comes from indexer tables.
- Current-round weekly brand leaderboard prefers live aggregation from raw indexer votes.
- All-time brand/user dashboard views may use Turso materialized tables to combine S1 and S2 data.
- Materialization code creates/updates Turso tables at runtime if needed.

Primary files:

- `src/lib/seasons/adapters/index.ts`
- `src/lib/seasons/adapters/indexer.ts`
- `src/lib/seasons/adapters/indexer-brands.ts`
- `src/lib/seasons/adapters/indexer-users.ts`

### Applications/onchain publishing

Observed:

1. `/apply` uses brand form components and `applyBrand`.
2. `applyBrand` verifies wallet signature and optional token gate before inserting a pending Turso brand row.
3. `/dashboard/applications` reads Turso pending rows where `banned = 1`.
4. Application management can approve in DB, delete, edit, prepare metadata, and invoke onchain create/update flows through wallet-connected UI.
5. `prepareBrandMetadata` calls an external backend endpoint with `INDEXER_API_KEY`.
6. `syncUpdatedOnchainBrandInDb` updates or creates Turso rows using several ID/handle/name fallback strategies.

Primary files:

- `src/lib/actions/brand-actions.ts`
- `src/app/dashboard/applications/page.tsx`
- `src/components/dashboard/ApplicationsTable.tsx`
- `src/components/dashboard/CreateOnchainPanel.tsx`
- `src/components/dashboard/UpdateOnchainPanel.tsx`

### Intelligence SQL flow

Observed:

1. `/dashboard/intelligence` posts natural-language questions to `/api/intelligence/query`.
2. The API checks session and `INTELLIGENCE` permission.
3. Gemini generates SQL from `DATABASE_SCHEMA`.
4. `isQuerySafe` validates the SQL.
5. `executeQuery` runs the query against the Postgres indexer with `$queryRawUnsafe` after validation, sanitization, limit enforcement, and timeout.
6. Results may be enriched with brand metadata.
7. Gemini formats summaries and suggestions.
8. Results are cached in Redis by normalized question hash.

Primary files:

- `src/app/dashboard/intelligence/page.tsx`
- `src/app/api/intelligence/query/route.ts`
- `src/lib/gemini.ts`
- `src/lib/intelligence/schema.ts`
- `src/lib/intelligence/sql-validator.ts`
- `src/lib/intelligence/query-executor.ts`

Conflict:

- `src/lib/gemini.ts` prompt says "ONLY SELECT queries".
- `src/lib/intelligence/sql-validator.ts` allows `CREATE TEMPORARY TABLE`.
- The implementation behavior is therefore less strict than the prompt text.

### Auth and permissions

Observed:

- Middleware protects `/dashboard/*` by requiring a NextAuth JWT/session token.
- NextAuth providers include Google and Farcaster credentials.
- Farcaster auth supports SIWE verification and password-based admin login.
- `ALLOWED_FIDS` and `ADMIN_PASSWORD` can elevate/login users.
- Route permissions are defined in `src/lib/auth/permissions.ts`.
- Client route content is wrapped by `PermissionGuard`.
- Server actions and API routes perform server-side permission checks for sensitive operations.

Primary files:

- `src/middleware.ts`
- `src/auth.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/auth-checks.ts`
- `src/components/auth/PermissionGuard.tsx`
- `src/hooks/use-admin-user.tsx`

## 5. Architectural Invariants

These are current implementation constraints that future changes should preserve unless intentionally redesigning the architecture.

### Observed/inferred invariants

- Brand identity is cross-system and migration-sensitive. Do not assume Turso `brands.id`, indexer `brands.id`, and `onChainId` are interchangeable without checking the specific flow.
- Season 2 metrics should be read from the indexer, not from Turso application rows.
- Turso brand rows are operational metadata/write-side records; they do not replace indexer metrics.
- Season 1 points are snapshot/baseline data and are added to S2 points in all-time views.
- EVM/indexer token/point amounts may be 1e18-scaled decimals and must be normalized consistently before display or aggregation.
- Brand metadata fallback order matters. Changing it can alter user-visible brand names, images, categories, and descriptions.
- Permission checks must exist server-side for mutations and protected APIs. Client guards are not sufficient.
- Intelligence SQL must remain constrained to indexer-safe analytical reads. Any expansion of allowed SQL requires explicit security review.
- Runtime DDL/materialization code must be treated as production-impacting database behavior, not as harmless cache code.

## 6. Risks and Technical Debt

### Multi-source drift

Observed:

- Brand metadata may exist in Turso, MySQL, static JSON, IPFS, and indexer/onchain data.
- Admin application flows can sync Turso rows after onchain writes with multiple fallback matching strategies.

Risk:

- A single brand can display different names/images/categories depending on the view and fallback path.

### Runtime DDL/materialization

Observed:

- Turso leaderboard materialization paths create tables and indexes at runtime.
- `scripts/migrate-turso.ts` also manages schema creation/migration.

Risk:

- Runtime schema work can introduce latency or unexpected behavior in serverless environments.

### Normalization duplication

Observed:

- Indexer point normalization logic exists in multiple files.
- Some logic uses a scaled-value threshold; other logic assumes 1e18 scaling directly.

Risk:

- A scoring change or upstream indexer change can produce inconsistent displayed points across pages.

### Legacy migration risk

Observed:

- Season 1 MySQL remains in code and schemas.
- Static S1 snapshots are required for all-time combined views.
- `SeasonRegistry` includes a TODO for S1 start date.

Risk:

- Removing or changing MySQL/snapshot assumptions can break all-time scoring and fallback metadata.

### Security-sensitive areas

Observed:

- Auth and permissions are distributed across middleware, NextAuth callbacks, API routes, server actions, and client guards.
- Intelligence executes generated SQL through `$queryRawUnsafe` after validation.
- Onchain flows handle signatures, wallet admin checks, RPCs, transaction receipts, and DB sync.
- File/image upload integrations use Cloudflare Images and external URL handling.

Risk:

- Small changes in these areas can create authorization bypasses, unsafe SQL execution, wrong-wallet writes, or incorrect onchain/DB state.

## 7. Documentation Conflicts

Observed conflicts between docs and current implementation:

- `PHASE3_IMPLEMENTATION.md` says Phase 3 was partially implemented, while `OPTIMIZATION_PROGRESS.md` says Phase 3 was completed. Current code includes server components for leaderboard, dashboard analytics, and brand evolution, so the newer/completed description appears closer to implementation.
- Some docs mention `.env.example`, but the repository contains `env_template`. Several env vars used in code are not listed in `env_template`.
- `README.md` remains mostly create-next-app boilerplate and does not describe the actual architecture.
- `TURSO_OPTIMIZATION_SUMMARY.md` mentions `npm run migrate:turso`, but `package.json` does not define a `migrate:turso` script.

## 8. Open Questions

- Which deployment target is authoritative for production: Netlify, Vercel, Railway-backed services, or a combination?
- Is Turso intended to remain the long-term brand metadata source, or is onchain/IPFS expected to become authoritative?
- Is `onChainId` guaranteed to match indexer `brands.id` for all brands?
- Should `CREATE TEMPORARY TABLE` remain allowed in intelligence SQL despite the prompt requiring only SELECT?
- Should MySQL remain online indefinitely, or should Season 1 be fully represented by static snapshots?
- Which environment variable template is authoritative, given `env_template` does not list every env var used by code?
- Are `prisma/schema.write.prisma` and `prisma/schema.admin.prisma` actively used in production, or are they transitional artifacts?
- What is the canonical owner/guardian identity for a brand when `ownerFid`, `ownerWalletFid`, wallet address, and onchain FID disagree?
