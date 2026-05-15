# BRND_OS Brand Identity Audit

This document audits brand identity semantics and source-of-truth boundaries in the current repository state. It is based on observed code, schemas, scripts, and existing runtime paths. It does not propose runtime changes.

## Executive Summary

### Observed Facts

- The active brand runtime uses multiple numeric and textual identity fields for the same real-world brand.
- The Postgres indexer/onchain side uses `brands.id` as the indexed onchain brand id and joins leaderboards through `brand_id`.
- The Turso admin/write side uses `brands.id` as its local primary key and optionally stores an onchain mapping in `onChainId`.
- Brand detail pages currently resolve `/dashboard/brands/[id]` by using the route id against both Turso `brands.id` and indexer `brands.id`.
- Onchain create flows write to the contract and then save/display Turso data, but the direct create and application approval paths do not reliably persist the emitted onchain brand id back into Turso.
- Onchain update sync contains multiple fallbacks: `onChainId`, Turso `id`, exact text identity, canonicalized text identity, then optional row creation.
- No runtime brand slug route or slug source of truth was found in the audited implementation. Routes use numeric ids.
- Handles, channels, and profiles are normalized in multiple places with different rules.
- IPFS metadata hashes are treated as the pointer to editable/display metadata, not as a stable brand identity by themselves.

### Inferences

- The intended long-term identity boundary appears to be: onchain/indexer brand id is authoritative for scoring and leaderboards; Turso is the editable/admin metadata layer; static snapshots are display fallbacks.
- `onChainId` exists to bridge Turso rows to indexer/onchain rows, but current code still supports legacy schemas and rows where that field is absent or unset.
- Because fallback matching can update by name/channel/profile/handle, the system is in a transitional migration state where identity is not fully normalized.

### Open Questions

- Whether Turso `brands.id` is expected to equal indexer/onchain `brands.id` for all active brands.
- Whether future application approval should persist contract-emitted `brandId` into Turso.
- Whether `channel`, `profile`, and `handle` are expected to be globally unique across all brands or only best-effort lookup fields.
- Whether `metadataHash` should be stored in Turso for newly created/approved brands.

## Identity Field Map

| Field | Origin | Persisted In | Consumed By | Authority |
| --- | --- | --- | --- | --- |
| `indexer brands.id` | Onchain `brandId` indexed from BRND contract events/tables | Postgres indexer `brands.id` via `prisma/schema.indexer.prisma` | Season adapters, leaderboard joins, brand detail, admin indexer search, intelligence schema | Authoritative for S2/onchain scoring and indexed onchain state |
| `Turso brands.id` | Turso autoincrement/admin DB row id | Turso `brands.id`; Prisma write schema models it as `Brand.id` | Admin brand listing/detail/edit, applications, local metadata lookup, fallback sync | Authoritative only for Turso row identity; unsafe to assume equal to onchain id unless proven |
| `onChainId` | Intended mapping from Turso row to onchain/indexer id | Turso `brands.onChainId` when column exists; Prisma write schema marks it unique | `getOnchainUpdateBrandFromDb`, `syncUpdatedOnchainBrandInDb` | Authoritative bridge when populated; fallback-only when absent |
| Contract `brandId` | BRND contract `createBrand` return/event/indexer result | Onchain contract and Postgres indexer | `getBrand`, update calls, indexer tables, leaderboard joins | Authoritative onchain id |
| `handle` | Manual admin input, Farcaster canonical handle, or backend metadata preparation response | Onchain contract `handle`; indexer `handle`; sometimes Turso `onChainHandle` or legacy `handle` if columns exist | Contract create/update, indexer search, update sync fallback, display fallback | Authoritative onchain label, but not a safe unique DB join in current code |
| `onChainHandle` | Synced onchain handle into Turso | Turso optional column; Prisma write schema has `onChainHandle` | Update sync fallback exact/canonical matching | Bridge/fallback-only unless paired with `onChainId` |
| `channel` | Application/admin form, Google Sheet, Farcaster channel lookup | Turso `brands.channel`; static snapshot `channel`; sheet rows | Listings, brand detail, duplicate checks, Farcaster fetch, update sync fallback | Metadata/display and lookup field; not authoritative id |
| `profile` | Application/admin form, Google Sheet, Farcaster profile lookup | Turso `brands.profile`; sheet rows | Applications, detail, duplicate checks, Farcaster fetch, update sync fallback | Metadata/display and lookup field; not authoritative id |
| Slug | Not observed as a runtime brand identity | No runtime brand slug persistence found in audited paths | No numeric brand routes were slug-based | Not active/undetermined |
| `metadataHash` / `metadata_hash` | Backend metadata preparation or contract/indexer state | Onchain/indexer `metadata_hash`; optional Turso `metadataHash` in Prisma write schema | IPFS metadata enrichment, detail fallbacks, update panels | Authoritative pointer for metadata version; not canonical brand identity |
| IPFS metadata fields | IPFS JSON fetched through metadata hash | IPFS gateways; sometimes copied into Turso fields after sync | Brand detail, update form, cards | Fallback/enrichment data |
| `fid` / `ownerFid` / `ownerWalletFid` | Farcaster/Neynar/user input; contract stores onchain `fid` | Indexer `fid`; Turso owner fields; application rows | Create/update contract args, guardian display, ownership metadata | Context-specific; not a brand id |
| Wallet address | Connected/admin wallet or contract state | Indexer `wallet_address`; Turso wallet fields | Contract create/update, owner display, application metadata | Ownership/permission metadata; not brand identity |

## Source-of-Truth Boundaries

### Observed Facts

- Postgres indexer data is read through `prismaIndexer` and schema `prisma/schema.indexer.prisma`.
- Indexer brand identity fields include `id`, `fid`, `wallet_address`, `handle`, `metadata_hash`, and chain-derived totals.
- Leaderboard tables join brands by `brand_id`, which is the same numeric identity as indexer/onchain `brands.id`.
- Turso is used directly through `src/lib/turso.ts` calls for admin/edit/application metadata and materialized leaderboard cache tables.
- MySQL is used only as legacy metadata enrichment where enabled, especially through `getBrandsMetadata`.
- `public/data/brands.json` is a static fallback snapshot keyed by numeric brand id.
- Redis/Upstash is used as a metadata/cache layer, not as a source of identity truth.

### Inferences

- For scoring and leaderboard correctness, indexer/onchain ids must be treated as the canonical numeric brand id.
- Turso ids can only be safely joined to indexer ids when `onChainId` exists and is populated or when the code has explicitly proven legacy id parity.
- Static snapshots and MySQL should be treated as display metadata fallbacks keyed by the same numeric id convention used by scoring.

## Current Fallback Order

### Brand Detail Resolution

Observed in `src/app/dashboard/brands/[id]/page.tsx`:

1. Parse route `[id]` as a number.
2. Read Turso `brands` by `id = routeId`.
3. Read indexer brand by `id = routeId`.
4. Read indexer `metadata_hash` by `id = routeId`.
5. If indexer metadata hash is missing, call contract `getBrand(routeId)` and use returned `metadataHash`.
6. If local fields are missing and metadata hash exists, fetch IPFS metadata.
7. If MySQL is enabled, use MySQL as fallback for missing description/category.
8. Render fields with priority roughly: Turso fields, IPFS metadata, indexer/onchain display fields, generated fallback values.

Risk: this route assumes the incoming id can address both Turso and indexer identities. That is safe only if ids are synchronized or the Turso row happens to be keyed by onchain id.

### Brand Listing And Leaderboards

Observed in `src/lib/seasons/adapters/indexer-brands.ts` and `src/lib/seasons/enrichment/brands.ts`:

1. Leaderboards read indexer tables by `brand_id`.
2. Brand metadata is enriched by numeric ids through Redis, MySQL, or static snapshot.
3. If metadata is missing, display falls back to indexer/onchain `handle` or `Brand #id`.
4. Search by numeric query treats the value as a leaderboard/indexer brand id.
5. Text search resolves ids from indexer `handle` plus Turso `name`/`channel` matches.

Risk: text search can blend Turso-local metadata hits with indexer ids. Numeric result rows remain indexer ids, but the search discovery step can introduce ambiguity when local Turso ids and onchain ids diverge.

### Onchain Update Sync

Observed in `src/lib/actions/brand-actions.ts` and `src/components/dashboard/UpdateOnchainPanel.tsx`:

1. Admin selects an indexer brand id.
2. UI reads contract/indexer data and attempts Turso lookup by `onChainId = id OR id = id`.
3. Metadata may be loaded from indexer/contract `metadataHash` and IPFS.
4. Contract update calls `updateBrand(selected.id, metadataHash, fid, walletAddress)`.
5. DB sync tries to update Turso row by `onChainId`.
6. If no row, update Turso row by `id`.
7. If no row, exact text fallback matches `onChainHandle`, `handle`, `channel`, `profile`, or `name`.
8. If no row, canonical text fallback strips `@`, spaces, hyphens, underscores, and dots before matching.
9. If still no row and `categoryId` exists, insert a missing Turso row.

Risk: exact and canonical text fallback can merge different brands that share normalized names or handles.

### Application Approval

Observed in `src/app/dashboard/applications/page.tsx`, `src/components/dashboard/ApplicationsTable.tsx`, and `src/lib/actions/brand-actions.ts`:

1. Pending applications are Turso `brands` rows where `banned = 1`.
2. Approval prepares metadata using channel/profile/name/owner data.
3. UI calls contract `createBrand(handle, metadataHash, fid, walletAddress)`.
4. After receipt, `approveBrandInDb(app.id)` only updates `banned = 0`.
5. No observed code extracts the emitted onchain brand id or stores it into `onChainId` during this path.

Risk: an approved application can become active in Turso without a durable Turso-to-onchain mapping.

### Direct Onchain Create

Observed in `src/components/dashboard/CreateOnchainPanel.tsx` and `src/lib/actions/brand-actions.ts`:

1. Admin creates metadata and calls contract `createBrand`.
2. After receipt, `createBrandDirect` inserts a Turso row.
3. The observed insert validates duplicates by `name` and normalized channel/profile, but does not persist the contract-emitted brand id.

Risk: direct create can also leave `onChainId` unset unless another sync path later links it.

### Google Sheet Lookup

Observed in `src/app/api/admin/sheet/brands/route.ts`:

1. Sheet rows load from CSV using `BRANDS_SHEET_ID`/`BRANDS_SHEET_GID` or defaults.
2. `bid` is parsed from `bid`, `id`, or `brand id`.
3. Query scoring gives high weight to exact `bid`, exact normalized channel/profile, exact ticker, and name prefix.
4. Results are filtered by strict score `>= 300`.
5. Caller-side code treats score `>= 300` as reliable.

Risk: sheet `bid` semantics are assumed to align with brand ids, but this is external data and not enforced by the repo.

## Canonicalization And Fuzzy Matching

### Observed Facts

- `normalizeProfileInput` strips Farcaster/Warpcast URL wrappers, leading `@` and `/`, path/query/hash, lowercases, and validates profile handles with an optional `.eth` suffix.
- `normalizeChannelInput` strips Farcaster/Warpcast URL wrappers, leading `@` and `/`, path/query/hash, lowercases, and accepts any non-empty result.
- `toCanonicalHandle` returns profile normalization for query type `"1"` and channel normalization otherwise.
- Application approval normalizes onchain handle by stripping leading `@` or `/`, trimming, and lowercasing.
- Onchain sync exact fallback compares lowercase `handle`, `channel`, `profile`, and `name`.
- Onchain sync canonical fallback removes non-alphanumeric characters from candidate keys and removes `@`, spaces, hyphens, underscores, and dots from DB columns.
- Sheet scoring uses Levenshtein distance only as a tie-breaker after score, not as a standalone match threshold.

### Dangerous Ambiguity Cases

- `base`, `/base`, `@base`, `Base`, and `base.eth` can normalize differently depending on whether the code path is channel, profile, handle, or canonical text fallback.
- `brand-name`, `brand_name`, `brand.name`, `@brand name`, and `brandname` can collapse to the same canonical fallback key.
- A brand name can be used as a fallback identity key alongside channel/profile/handle, so a display-name collision can update the wrong row.
- A Turso row with `id = 42` and no `onChainId` can be treated as the same identity as indexer/onchain brand `42`.
- Missing optional columns (`onChainId`, `onChainHandle`, legacy `handle`) cause the sync logic to silently use broader fallback matching.
- Approval creates/activates a Turso row before a durable onchain mapping is observed in the database.
- IPFS metadata can override missing display fields but does not prove identity; using metadata contents as identity would be unsafe.

## Files And Functions Involved

### Brand Resolution

- `src/app/dashboard/brands/[id]/page.tsx`: brand detail route resolution, Turso/indexer/IPFS/MySQL fallback composition.
- `src/app/dashboard/brands/page.tsx`: dashboard brand list entry point.
- `src/components/dashboard/BrandsTableS2.tsx`: S2 brand table rendering and navigation.
- `src/lib/seasons/adapters/indexer-brands.ts`: indexer brand listing, search, all-time/weekly leaderboard mapping, `getIndexerBrandById`.
- `src/lib/seasons/enrichment/brands.ts`: metadata enrichment by numeric brand ids.

### Metadata Enrichment

- `src/lib/seasons/enrichment/brands.ts`: Redis/MySQL/static snapshot metadata loading.
- `src/app/api/admin/indexer/metadata/route.ts`: IPFS metadata batch loading by indexer metadata hash.
- `src/app/dashboard/brands/[id]/page.tsx`: detail-page IPFS metadata fallback.
- `src/components/dashboard/UpdateOnchainPanel.tsx`: form hydration from indexer, contract, DB, and IPFS metadata.
- `scripts/generate-brands-snapshot.cjs`: MySQL-to-static snapshot generation.
- `scripts/sync-brands-from-google-sheet.ts`: Google Sheet-to-static snapshot generation.

### Onchain Sync

- `src/config/brnd-contract.ts`: contract ABI for `createBrand`, `updateBrand`, and `getBrand`.
- `src/components/dashboard/CreateOnchainPanel.tsx`: direct onchain creation and follow-up Turso insert.
- `src/components/dashboard/UpdateOnchainPanel.tsx`: contract update and follow-up Turso sync.
- `src/lib/actions/brand-actions.ts`: `prepareBrandMetadata`, `createBrandDirect`, `getOnchainUpdateBrandFromDb`, `syncUpdatedOnchainBrandInDb`, `checkBrandHandleExists`.
- `src/app/api/admin/indexer/brands/route.ts`: searchable indexer brand source for update UI.

### Application Approval

- `src/app/dashboard/applications/page.tsx`: reads pending Turso application rows where `banned = 1`.
- `src/components/dashboard/ApplicationsTable.tsx`: prepares metadata, calls contract `createBrand`, and calls `approveBrandInDb`.
- `src/lib/actions/brand-actions.ts`: `applyBrand`, `approveBrandInDb`, validation and DB mutation helpers.

### Leaderboard Joins

- `prisma/schema.indexer.prisma`: indexer table mappings for `brands.id`, `votes.brand_ids`, and leaderboard `brand_id`.
- `src/lib/seasons/adapters/indexer-brands.ts`: S2 brand leaderboard joins and materialization.
- `src/lib/seasons/adapters/indexer.ts`: generic indexer leaderboard/vote parsing.
- `src/lib/dashboard/stats.ts`: dashboard leaderboard/stat joins.
- `src/app/api/leaderboard/route.ts`: public leaderboard API.
- `src/app/api/admin/seasons/leaderboard/route.ts`: admin season leaderboard API.
- `src/app/api/intelligence/query/route.ts`: AI SQL response enrichment when `brand_id` appears.
- `src/lib/gemini.ts`, `src/lib/intelligence/schema.ts`, `scripts/sync-intelligence-schema.ts`: SQL guidance/schema documentation for intelligence queries.

## Synchronization Assumptions

### Observed Facts

- Indexer tables are read-only from the app perspective.
- Turso is mutable through admin/apply/create/update flows.
- Static snapshots are generated by scripts and are not live synchronization.
- Onchain metadata is prepared externally through `prepareBrandMetadata`, then persisted through contract calls and sometimes copied into Turso fields.
- Some code paths explicitly tolerate missing Turso columns, which indicates deployed schema drift is expected.

### Inferences

- The system assumes eventual consistency between onchain/indexer and Turso metadata.
- Sync code assumes that `onChainId` is preferred, but legacy ids/textual identity may be needed during migration.
- Leaderboard correctness assumes indexer `brand_id` and enrichment keys refer to the same numeric brand universe.

### Unresolved Uncertainty

- There is no observed invariant enforcement that every active Turso brand has exactly one `onChainId`.
- There is no observed migration guarantee that Turso ids were backfilled from onchain ids.
- There is no observed uniqueness constraint for normalized `channel`, `profile`, or `name` in Turso runtime DDL.

## Migration Assumptions

### Observed Facts

- `prisma/schema.write.prisma` includes `onChainId`, `onChainFid`, `onChainHandle`, `onChainWalletAddress`, and `metadataHash`.
- `scripts/migrate-turso.ts` creates `onChainId` and later code handles missing onchain columns.
- Sync code catches missing-column errors and falls back to legacy behavior.
- Comments in mapper code state that `ownerWalletFid` is transitional and `guardianFid` is canonical from the source side.

### Inferences

- Turso is mid-migration from a legacy offchain brand table toward explicit onchain identity mapping.
- Several fallbacks exist to keep admin workflows usable before all rows/columns are migrated.

## Accidental Cross-Brand Merge Risks

| Risk | Mechanism | Impact |
| --- | --- | --- |
| Turso id equals onchain id by accident | Detail/update fallback uses `id = routeId` or `id = brandId` | Wrong local metadata can attach to an onchain brand |
| Text identity collision | Sync fallback matches lowercased handle/channel/profile/name | Wrong row can be updated after onchain update |
| Canonical text collision | Sync fallback strips punctuation and separators | Distinct brands can collapse to one lookup key |
| Name-based matching | Brand name participates in fallback identity lookup | Display-name duplicates can merge metadata |
| Missing mapping after approval | Approval toggles `banned` but does not store returned onchain id | Active Turso row may not join to scoring identity |
| Sheet id mismatch | Sheet `bid` is trusted for lookup/snapshot keys | External sheet errors can poison metadata matching |
| IPFS metadata drift | Metadata hash changes across updates | Display fields may change without changing numeric identity |
| Slug assumptions | No active slug identity found | Future slug work could accidentally duplicate handle/channel semantics |

## Rules Future Changes Should Follow

These are constraints implied by current behavior, not proposed refactors.

- Treat indexer/onchain `brands.id` and leaderboard `brand_id` as the scoring identity.
- Treat Turso `brands.id` as local row identity unless `onChainId` proves linkage to onchain/indexer identity.
- Do not use `name`, `channel`, `profile`, or `handle` alone as a durable cross-system join without explicitly accepting collision risk.
- Preserve the existing fallback order when changing detail, listing, or update flows unless the migration state has been verified.
- Do not assume slug support exists in runtime routing.
- Do not treat IPFS metadata contents as identity proof; use metadata hashes only as metadata pointers.
- Be careful around `syncUpdatedOnchainBrandInDb`; it is the broadest and most security-sensitive identity mutation path.
- Be careful around application approval; it crosses Turso, metadata preparation, wallet signing, contract writes, and permission checks.
- For leaderboard/intelligence queries, join by indexer `brand_id`/`brands.id`, not by textual metadata.

## Open Questions Before Implementation

- Should every non-banned Turso brand have a non-null `onChainId`?
- Should application approval extract the created onchain `brandId` from logs/receipt and persist it?
- Should direct create persist `onChainId`, `metadataHash`, and onchain fields after contract confirmation?
- Is `channel` or `profile` intended to be unique across active brands?
- Is `handle` expected to equal normalized channel/profile, or can it differ from both?
- Which external system owns `metadataHash`: the contract/indexer only, Turso only after sync, or both?
- Are Google Sheet `bid` values guaranteed to be onchain/indexer ids or legacy MySQL/Turso ids?
- Is MySQL still expected to contain active canonical metadata, or is it strictly legacy fallback?
- Should canonical fallback matching remain enabled after migration, or is it only a temporary rescue path?
- Are existing Turso ids known to match onchain ids for any historical subset?
