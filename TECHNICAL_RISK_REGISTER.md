# BRND_OS Technical Risk Register

This register consolidates risks supported by `ARCHITECTURE.md`, `ENVIRONMENT.md`, `BRAND_IDENTITY_AUDIT.md`, and `SCORE_NORMALIZATION_AUDIT.md`. It is intended as future Codex context, not as a migration plan.

## Top 5 Risks To Address First

1. **Unreliable Turso-to-onchain brand mapping**: active Turso rows can lack `onChainId`, while detail/update paths can assume id parity.
2. **Fallback identity matching can merge brands**: update sync can match by name/channel/profile/handle and canonicalized text.
3. **Inconsistent scoring normalization**: different files apply different 1e18 conversion rules and vote weights.
4. **Intelligence SQL policy mismatch**: prompt says SELECT-only, validator allows more, and score scaling guidance conflicts.
5. **Production-critical env/schema drift**: indexer, Turso, Redis, auth, RPC, and metadata env vars are required conditionally and docs/configs have had gaps.

## Brand Identity

### 1. Turso id and onchain/indexer id ambiguity

- **Area affected:** Brand detail, brand listing/search, onchain update, leaderboard metadata joins.
- **Evidence / source:** `BRAND_IDENTITY_AUDIT.md` sections “Identity Field Map”, “Brand Detail Resolution”, “Accidental Cross-Brand Merge Risks”; `ARCHITECTURE.md` “Architectural Invariants”.
- **Severity:** high
- **Likelihood:** high
- **Impact:** Wrong Turso metadata can attach to an onchain brand; dashboard views can display or update the wrong brand.
- **Trigger conditions:** Turso `brands.id` differs from indexer `brands.id`; `onChainId` missing; route id or selected indexer id is reused against Turso `id`.
- **Recommended mitigation:** Establish and document a canonical lookup rule: prefer `onChainId` for cross-system joins; treat Turso `id` as local-only unless verified.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 2. Text fallback matching can merge distinct brands

- **Area affected:** Onchain update sync, admin update workflow, metadata persistence.
- **Evidence / source:** `BRAND_IDENTITY_AUDIT.md` “Onchain Update Sync”, “Canonicalization And Fuzzy Matching”, “Dangerous Ambiguity Cases”.
- **Severity:** critical
- **Likelihood:** medium
- **Impact:** An onchain update can overwrite the wrong Turso row through lowercase or punctuation-stripped matches.
- **Trigger conditions:** No row matched by `onChainId` or Turso `id`; two brands share normalized name/channel/profile/handle; optional onchain columns are missing.
- **Recommended mitigation:** Gate fallback matches behind explicit admin confirmation or restrict them to unique, audited candidates.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 3. Approved applications may become active without onchain mapping

- **Area affected:** Application approval, brand listing, future scoring joins.
- **Evidence / source:** `BRAND_IDENTITY_AUDIT.md` “Application Approval”; `ARCHITECTURE.md` “Applications/onchain publishing”.
- **Severity:** high
- **Likelihood:** high
- **Impact:** A Turso brand can be unbanned and visible without persisted `onChainId` or `metadataHash`, preventing durable connection to indexer scoring.
- **Trigger conditions:** Application approval calls `createBrand`, then only sets `banned = 0`.
- **Recommended mitigation:** Capture created onchain brand id/metadata hash after transaction and persist a verified mapping.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 4. External Sheet `bid` semantics can poison identity matching

- **Area affected:** Sheet lookup, snapshot generation, metadata enrichment.
- **Evidence / source:** `BRAND_IDENTITY_AUDIT.md` “Google Sheet Lookup” and “Accidental Cross-Brand Merge Risks”.
- **Severity:** medium
- **Likelihood:** medium
- **Impact:** Sheet ids can be treated as brand ids even if they refer to legacy or incorrect ids.
- **Trigger conditions:** Sheet `bid` diverges from indexer/onchain id; default sheet changes; import scripts regenerate snapshots.
- **Recommended mitigation:** Document whether `bid` is indexer/onchain id or legacy id and validate sheet rows before sync.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

## Scoring / Leaderboards

### 5. Inconsistent 1e18 score normalization

- **Area affected:** Brand leaderboards, user leaderboards, brand detail, intelligence outputs.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “Highest-Risk Findings”, “Normalization Rules”, “Inconsistent Normalization Rules”.
- **Severity:** high
- **Likelihood:** high
- **Impact:** Same raw indexer value can display differently across pages; all-time rankings can drift.
- **Trigger conditions:** Indexer emits unscaled or mixed-scale values; code path uses threshold-aware conversion in one view and always-scaled conversion in another.
- **Recommended mitigation:** Decide and document whether indexer `points` are always 1e18-scaled, then centralize conversion.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 6. Live weekly leaderboard weights differ from analytics weights

- **Area affected:** Public leaderboard, dashboard analytics, brand evolution charts.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “Vote Weights Defined”, “Duplicated Aggregation Pipelines”.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Current leaderboard, analytics, and evolution charts can tell conflicting stories about brand momentum.
- **Trigger conditions:** Comparing active weekly leaderboard (`100/50/25`) to analytics/evolution (`3/2/1`) or indexer materialized points.
- **Recommended mitigation:** Label analytics as non-leaderboard metrics or align weights after confirming product semantics.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

### 7. Float precision loss in large decimal conversions

- **Area affected:** Brand weekly history, withdrawals, all-time materialized tables, intelligence results.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “Float / BigInt / String Conversion Risks”.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** Large `DECIMAL(78,0)` values can be rounded, truncated, or displayed inconsistently.
- **Trigger conditions:** Direct `Number(decimal)` or storing normalized values as Turso `REAL`.
- **Recommended mitigation:** Prefer BigInt/string decimal formatting for token-like values and avoid `REAL` for exact scores.
- **Requires code changes:** yes
- **Requires product/architecture decision:** maybe

### 8. S1 baseline assumptions are brittle

- **Area affected:** All-time brand/user totals, Season 1 pages, migration cleanup.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “S1 Scores Read”; `ARCHITECTURE.md` “Legacy migration risk”.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Removing MySQL/snapshot assumptions or regenerating snapshots incorrectly can corrupt all-time totals.
- **Trigger conditions:** Snapshot files missing, stale, regenerated from wrong cutoff, or S1 start/cutoff assumptions changed.
- **Recommended mitigation:** Treat `public/data/s1/*` as versioned scoring inputs and document regeneration procedure.
- **Requires code changes:** no for documentation; yes for enforcement
- **Requires product/architecture decision:** yes

## Data Source Drift

### 9. Multi-source metadata drift

- **Area affected:** Brand name/image/category/description across pages.
- **Evidence / source:** `ARCHITECTURE.md` “Multi-source drift”; `BRAND_IDENTITY_AUDIT.md` “Source-of-Truth Boundaries”.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** Same brand can display different metadata depending on fallback path.
- **Trigger conditions:** Turso, MySQL, IPFS, static JSON, and indexer data diverge.
- **Recommended mitigation:** Document per-field source precedence and add checks for drift before sync/import tasks.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

### 10. Legacy MySQL availability remains operationally relevant

- **Area affected:** S1 adapter, metadata fallbacks, snapshot scripts.
- **Evidence / source:** `ARCHITECTURE.md` “Data Source Architecture”, “Legacy migration risk”; `ENVIRONMENT.md` “MySQL Legacy”.
- **Severity:** medium
- **Likelihood:** medium
- **Impact:** Features depending on MySQL fallback or snapshot regeneration fail when MySQL is unavailable.
- **Trigger conditions:** `MYSQL_DISABLED=false` with missing/invalid `MYSQL_DATABASE_URL`; MySQL decommissioned before snapshots/metadata are independent.
- **Recommended mitigation:** Decide whether MySQL remains supported or snapshots become the only S1 source.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

## Auth / Permissions

### 11. Distributed auth and permission enforcement

- **Area affected:** Dashboard routes, server actions, APIs, onchain/admin mutations.
- **Evidence / source:** `ARCHITECTURE.md` “Auth and permissions”, “Security-sensitive areas”; `ENVIRONMENT.md` “Auth”.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Inconsistent checks can create authorization bypasses or over-permissive admin operations.
- **Trigger conditions:** New API/action relies only on client guard; auth env misconfigured; permission additions do not update all layers.
- **Recommended mitigation:** Require server-side permission checks for every mutation/protected API and audit new routes against `PERMISSIONS`.
- **Requires code changes:** yes for enforcement/tests
- **Requires product/architecture decision:** no

### 12. Admin auth secrets and allowlists are production-critical

- **Area affected:** Login, admin elevation, deployment security.
- **Evidence / source:** `ENVIRONMENT.md` “Production-Critical Variables”, “Auth”; previous `AUTH_SECRET` placeholder replacement.
- **Severity:** critical
- **Likelihood:** medium
- **Impact:** Weak/missing secrets or wrong `ALLOWED_FIDS`/`ADMIN_PASSWORD` can lock out admins or allow unauthorized access.
- **Trigger conditions:** Missing `AUTH_SECRET`/`NEXTAUTH_SECRET`; weak `ADMIN_PASSWORD`; stale `ALLOWED_FIDS`.
- **Recommended mitigation:** Manage auth secrets through deployment secret storage and document required rotation/ownership.
- **Requires code changes:** no
- **Requires product/architecture decision:** yes

## Environment / Deployment

### 13. Production topology and env ownership are unclear

- **Area affected:** Build, deploy, runtime configuration, incident response.
- **Evidence / source:** `ARCHITECTURE.md` “Current deployment/runtime assumptions” and “Open Questions”; `ENVIRONMENT.md` “Summary”.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** Incorrect assumptions about Netlify/Vercel/Railway/service ownership can break builds or runtime data access.
- **Trigger conditions:** Moving hosts, changing build env, relying on platform-provided vars without confirming production target.
- **Recommended mitigation:** Project owner declares authoritative deployment topology and required env owner per subsystem.
- **Requires code changes:** no
- **Requires product/architecture decision:** yes

### 14. Indexer connection requires exact configuration

- **Area affected:** Season 2 dashboard, leaderboards, intelligence, collectibles.
- **Evidence / source:** `ENVIRONMENT.md` “Postgres Indexer”; `ARCHITECTURE.md` deployment assumptions.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Season 2 reads return empty/stub data or fail if `INDEXER_DATABASE_URL` is missing, wrong, or lacks `schema=`.
- **Trigger conditions:** `INDEXER_DISABLED` not set as intended; missing schema query param; wrong indexer credentials.
- **Recommended mitigation:** Add deployment checklist and startup/diagnostic validation for indexer env.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** no

### 15. Public Web3 env vars expose client assumptions

- **Area affected:** Wallet UI, RPC reads, onchain create/update, token gating.
- **Evidence / source:** `ENVIRONMENT.md` “Web3 / Base”.
- **Severity:** medium
- **Likelihood:** medium
- **Impact:** Wrong public RPC/project IDs can cause failed wallet flows or reads against the wrong endpoint.
- **Trigger conditions:** Missing `NEXT_PUBLIC_BASE_RPC_URL(S)`, incorrect WalletConnect/Reown project id, disabled gating flags set incorrectly.
- **Recommended mitigation:** Maintain separate dev/prod Web3 env checklists and verify public values during release.
- **Requires code changes:** no
- **Requires product/architecture decision:** no

## Intelligence SQL

### 16. SQL safety policy mismatch

- **Area affected:** `/api/intelligence/query`, indexer database safety.
- **Evidence / source:** `ARCHITECTURE.md` “Intelligence SQL flow” conflict; `SCORE_NORMALIZATION_AUDIT.md` SQL guidance conflicts.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Generated SQL may be broader than intended, and future changes can weaken safety around `$queryRawUnsafe`.
- **Trigger conditions:** Validator allows SQL shape not reflected in prompt; prompt/schema guidance diverges; new SQL capabilities are added casually.
- **Recommended mitigation:** Align prompt, schema docs, validator, and executor policy; explicitly decide whether temp tables are allowed.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 17. Intelligence score scaling can be wrong or truncated

- **Area affected:** AI-generated leaderboard answers, exported intelligence charts.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “Inconsistent Normalization Rules”; `src/lib/gemini.ts` vs `src/lib/intelligence/schema.ts` documented conflict.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** AI summaries can report raw 1e18 values, truncated integer BRND, or inconsistent score values.
- **Trigger conditions:** Gemini generates SQL from conflicting instructions; query selects `points` without consistent scaling.
- **Recommended mitigation:** Make score scaling instructions single-source and add safe SQL examples for each leaderboard table.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

## Onchain Sync

### 18. Onchain create/update spans wallet, backend metadata, contract, and DB sync

- **Area affected:** Application approval, direct create, update onchain panel.
- **Evidence / source:** `ARCHITECTURE.md` “Applications/onchain publishing”, “Security-sensitive areas”; `BRAND_IDENTITY_AUDIT.md` “Onchain Sync”.
- **Severity:** critical
- **Likelihood:** medium
- **Impact:** Partial success can leave contract state, IPFS metadata, and Turso state inconsistent.
- **Trigger conditions:** Wallet transaction succeeds but DB sync fails; prepare-metadata returns unexpected handle/fid/wallet; RPC fallback disagrees; receipt parsing missing.
- **Recommended mitigation:** Add explicit transaction state tracking and post-transaction reconciliation checks before marking DB rows synced/approved.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 19. External metadata preparation is production-critical

- **Area affected:** Onchain create/update, IPFS metadata, brand display.
- **Evidence / source:** `ENVIRONMENT.md` `INDEXER_API_KEY`, `BACKEND_API_BASE_URL`; `BRAND_IDENTITY_AUDIT.md` metadata hash fields.
- **Severity:** high
- **Likelihood:** medium
- **Impact:** Missing/incorrect backend API or API key blocks publishing or produces metadata that cannot be resolved later.
- **Trigger conditions:** `INDEXER_API_KEY` invalid; backend default URL changes; returned `metadataHash`/handle/fid differs from UI expectations.
- **Recommended mitigation:** Treat prepare-metadata as an external contract with documented response invariants and failure handling.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

## Caching / Materialization

### 20. Runtime DDL/materialization can affect serverless latency and reliability

- **Area affected:** Leaderboards, Turso operational DB, cold starts.
- **Evidence / source:** `ARCHITECTURE.md` “Runtime DDL/materialization”; `SCORE_NORMALIZATION_AUDIT.md` “Live Vs Materialized / Cache Logic”.
- **Severity:** medium
- **Likelihood:** medium
- **Impact:** Runtime table/index creation can slow requests or behave unexpectedly under concurrent serverless execution.
- **Trigger conditions:** First request after deploy; expired materialization; missing tables; concurrent refresh.
- **Recommended mitigation:** Prefer explicit migration/setup jobs for schema and reserve runtime materialization for data refresh only.
- **Requires code changes:** yes
- **Requires product/architecture decision:** yes

### 21. Brand all-time materialized cache exists but appears unused

- **Area affected:** Brand all-time leaderboard performance and consistency.
- **Evidence / source:** `SCORE_NORMALIZATION_AUDIT.md` “All-Time Brand Materialization”, “Duplicated Aggregation Pipelines”.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** Maintainers may assume brand all-time reads use the materialized cache when they actually compute at read time.
- **Trigger conditions:** Performance tuning, changing materialized schema, relying on cache freshness for brand list.
- **Recommended mitigation:** Decide whether to wire it, remove it from assumptions, or document it as unused/transitional.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** yes

### 22. Redis cache dependency has partial degradation behavior

- **Area affected:** Metadata enrichment, intelligence cache, rate limits, wallet nonces.
- **Evidence / source:** `ARCHITECTURE.md` “Caching”; `ENVIRONMENT.md` “Redis / Upstash”.
- **Severity:** medium
- **Likelihood:** medium
- **Impact:** Missing Redis can degrade or break different subsystems differently.
- **Trigger conditions:** Missing `UPSTASH_REDIS_REST_URL/TOKEN`; Redis outage; undocumented `REDIS_CACHE_ENABLED` expectation.
- **Recommended mitigation:** Document per-subsystem Redis failure mode and add health diagnostics for production.
- **Requires code changes:** maybe
- **Requires product/architecture decision:** no

## Documentation Drift

### 23. Existing docs conflict with implementation

- **Area affected:** Onboarding, future implementation planning, env setup.
- **Evidence / source:** `ARCHITECTURE.md` “Documentation Conflicts”; `ENVIRONMENT.md` “Existing documentation conflicts”.
- **Severity:** medium
- **Likelihood:** high
- **Impact:** Future agents or contributors may follow stale commands, wrong env templates, or outdated phase descriptions.
- **Trigger conditions:** Using README/older phase docs instead of current architecture/env/audit docs.
- **Recommended mitigation:** Mark current docs as authoritative and update README to point to them.
- **Requires code changes:** no
- **Requires product/architecture decision:** no

### 24. Transitional schemas are not clearly classified

- **Area affected:** Prisma generation, Turso schema expectations, migration planning.
- **Evidence / source:** `ARCHITECTURE.md` open question on `prisma/schema.write.prisma` and `prisma/schema.admin.prisma`; `BRAND_IDENTITY_AUDIT.md` migration assumptions.
- **Severity:** low
- **Likelihood:** medium
- **Impact:** Contributors may update the wrong schema or infer nonexistent production guarantees.
- **Trigger conditions:** Schema change tasks, Prisma client regeneration, Turso migration work.
- **Recommended mitigation:** Document active vs transitional schema files and their production role.
- **Requires code changes:** no
- **Requires product/architecture decision:** yes

## Safe Next Implementation Goals

- Add a read-only diagnostic that reports Turso active brands missing `onChainId`, duplicate normalized channel/profile/name candidates, and rows where Turso id differs from `onChainId`.
- Create a score-normalization test harness that compares all current normalizers against representative raw values without changing runtime paths.
- Align intelligence SQL documentation and validator behavior in a docs-first proposal before changing executor code.
- Add an environment validation checklist or diagnostic route for production-critical variables without exposing secrets.
- Update README to point contributors to `ARCHITECTURE.md`, `ENVIRONMENT.md`, and the audit/register docs as authoritative.
- Document the exact S1 snapshot regeneration process and checksum/version expectations.

## Decisions Needed From Project Owner

- Is `onChainId` required for every active non-banned Turso brand?
- Should application approval and direct create persist created onchain `brandId`, `metadataHash`, and onchain handle/fid/wallet immediately?
- Are `channel`, `profile`, `handle`, or `name` allowed to be used as fallback identity joins after migration?
- Are indexer `points` always 1e18-scaled, or must threshold-aware mixed-scale support remain?
- Should active weekly leaderboard use `100/50/25`, `3/2/1`, or indexer materialized points as the product truth?
- Should fractional BRND points be preserved, rounded, or truncated in UI and intelligence outputs?
- Should `CREATE TEMPORARY TABLE` remain allowed in intelligence SQL?
- Which deployment target and environment template are authoritative for production?
- Is MySQL a long-term runtime dependency or only a snapshot generation source?
- Should Turso runtime DDL remain in request paths, or move to explicit migrations/setup jobs?
