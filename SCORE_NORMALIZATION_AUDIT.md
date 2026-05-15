# BRND_OS Score Normalization Audit

This document audits score normalization, aggregation, scaling, and leaderboard math in the current repository state. It is based on observed code, schemas, static data, and scripts. It does not modify runtime behavior.

## Executive Summary

### Observed Behavior

- Season 1 scores are stored as unscaled integer `points`/`score` values in legacy MySQL and static snapshots under `public/data/s1/`.
- Season 2 indexer scores are stored as `DECIMAL(78,0)` in Postgres. Most app code treats these as 1e18-scaled BRND amounts and converts them to JavaScript `number`.
- All-time brand and user totals combine S1 baseline snapshots with normalized S2 indexer points: `allTime = pointsS1 + pointsS2`.
- Current weekly brand leaderboard uses a live raw-vote aggregation path for the active round, with hardcoded vote weights `gold=100`, `silver=50`, `bronze=25`.
- Historical weekly brand leaderboard uses precomputed indexer `weekly_brand_leaderboard.points`, normalized from 1e18 scale.
- Some analytics/evolution endpoints use different vote weights (`3/2/1`) or raw vote counts rather than leaderboard points.
- There are multiple duplicated point normalization implementations, and they do not all behave the same.

### Inferred Intent

- The intended scoring model appears to be:
  - S1: legacy offchain integer points.
  - S2: onchain/indexer 1e18-scaled token-like point amounts.
  - Combined all-time displays: S1 integer baseline plus S2 normalized integer/decimal BRND points.
- The active weekly leaderboard likely prefers live vote aggregation so the current round updates before indexer leaderboard materialization catches up.

### Highest-Risk Findings

- Active weekly live leaderboard uses `100/50/25`, while other raw vote analytics use `3/2/1`; these are not equivalent to each other or clearly tied to the indexer materialized formula.
- `src/lib/seasons/adapters/indexer-brands.ts` always divides indexer points by 1e18, while `src/lib/seasons/adapters/indexer.ts` and `src/lib/seasons/adapters/indexer-users.ts` only divide when values exceed `1_000_000_000_000`.
- Brand detail weekly history uses `Math.round(Number(w.points) / 1e18)`, which differs from the BigInt-based normalizers and can lose precision before division.
- Intelligence SQL guidance conflicts internally: `src/lib/gemini.ts` tells generated SQL to divide `points` by `1e18`, while `src/lib/intelligence/schema.ts` says to use `points::numeric` or `ROUND(points::numeric, 2)` for large decimals.
- The brand all-time materialization table and refresh code exist, but no call to `ensureBrandsLeaderboardMaterialized()` was found. User all-time materialization is active.
- Several `Number(decimal)` or `Number(bigint)` conversions can silently lose precision for 78-digit values.

## Authoritative Scoring Paths

| Flow | Current path | Input | Output | Aggregation / normalization |
| --- | --- | --- | --- | --- |
| S1 brand baseline | `public/data/s1/brands-score.json` via `src/lib/seasons/s1-baseline.ts` | JSON object keyed by brand id, finite JS numbers | `Map<number, number>` | No scaling; values are used as stored |
| S1 user baseline | `public/data/s1/users-points.json` via `src/lib/seasons/s1-baseline.ts` | JSON object keyed by FID, finite JS numbers | `Map<number, number>` | No scaling; values are used as stored |
| S2 weekly current leaderboard | `IndexerAdapter.getWeeklyBrandLeaderboard()` -> `getLiveWeeklyLeaderboard()` in `src/lib/seasons/adapters/indexer.ts` | Raw indexer `votes.brand_ids` and timestamp | `LeaderboardBrand.points` as number | Raw votes: first = `+100`, second = `+50`, third = `+25` |
| S2 historical weekly leaderboard | `IndexerAdapter.getWeeklyBrandLeaderboard()` in `src/lib/seasons/adapters/indexer.ts` | `weekly_brand_leaderboard.points` as `DECIMAL(78,0)` | `LeaderboardBrand.points` as number | Threshold-aware 1e18 normalization |
| All-time brand list/detail | `getIndexerBrands()` / `getIndexerBrandById()` in `src/lib/seasons/adapters/indexer-brands.ts` | S1 snapshot + `all_time_brand_leaderboard.points` | `allTimePoints`, `pointsS1`, `pointsS2` as numbers | `pointsS1 + normalizeIndexerPoints(pointsS2)` |
| All-time user list/detail | `getIndexerUsers()` / `getIndexerUserByFid()` in `src/lib/seasons/adapters/indexer-users.ts` | S1 snapshot + indexer user/all-time points | `points`, `pointsS1`, `pointsS2` as numbers | `pointsS1 + normalizeIndexerPoints(pointsS2)` |
| Public `/api/leaderboard` | `src/app/api/leaderboard/route.ts` | Active season adapter response | JSON `score`, medal counts, totalVotes | Converts adapter `points` to `score` with `toSafeNumber` |

## Location Inventory

### S1 Scores Read

| File / function | Input format | Output format | Scaling assumptions | Duplication |
| --- | --- | --- | --- | --- |
| `src/lib/seasons/s1-baseline.ts` `getS1BrandScoreMap`, `getS1BrandScoreById` | `public/data/s1/brands-score.json`, object values must be finite numbers | `Map<number, number>` / number | No scaling. Values are assumed already display-ready integer scores. | Central runtime reader |
| `src/lib/seasons/s1-baseline.ts` `getS1UserPointsMap`, `getS1UserPointsByFid` | `public/data/s1/users-points.json`, object values must be finite numbers | `Map<number, number>` / number | No scaling. Values are assumed already display-ready points. | Central runtime reader |
| `scripts/generate-s1-snapshot.ts` `generateBaselineSnapshots` | MySQL `users.points`, `brands.score` | JSON snapshots | No scaling; writes MySQL values directly. | Duplicated by mysql2 script |
| `scripts/generate-s1-snapshot-mysql2.ts` baseline generation | MySQL `users.points`, `brands.score` | JSON snapshots | No scaling; coerces with `Number(...)`. | Alternative implementation of same snapshot |
| `src/lib/seasons/adapters/mysql.ts` | MySQL `brands.scoreWeek`, `users.points` | Season 1 adapter leaderboard values | No scaling. | Legacy adapter, separate from snapshots |
| `src/app/dashboard/season-1/page.tsx` | Static S1 files | UI display | No scaling observed in search results. | Display-only |

### S2 Scores Read

| File / function | Input format | Output format | Scaling assumptions | Duplication |
| --- | --- | --- | --- | --- |
| `src/lib/seasons/adapters/indexer.ts` `getWeeklyBrandLeaderboard` | `weekly_brand_leaderboard.points` as Decimal/string | `LeaderboardBrand.points` number | Uses threshold-aware conversion: values below `1_000_000_000_000` are unscaled; otherwise divide by 1e18. | Duplicated normalizer |
| `src/lib/seasons/adapters/indexer.ts` `getUserLeaderboard` | `all_time_user_leaderboard.points` | `UserRanking.points` number | Same threshold-aware conversion. | Duplicated normalizer |
| `src/lib/seasons/adapters/indexer-brands.ts` `normalizeIndexerPoints` | Decimal/number from indexer brand and leaderboard fields | number | Always interprets Decimal as 1e18-scaled; no threshold exception. | Different from indexer/indexer-users |
| `src/lib/seasons/adapters/indexer-users.ts` `normalizeIndexerPoints` | Decimal/number from indexer user fields | number | Threshold-aware conversion. | Duplicated normalizer |
| `src/app/dashboard/brands/[id]/page.tsx` weekly chart | `weekly_brand_leaderboard.points` | rounded chart score | `Math.round(Number(points) / 1e18)`. | Separate ad hoc conversion |
| `src/app/dashboard/brands/[id]/page.tsx` withdrawals | `brand_reward_withdrawals.amount` | fixed 4-decimal display | `Number(amount) / 1e18`. | Separate ad hoc conversion |
| `src/lib/intelligence/brand-evolution.ts` | `brands.total_brnd_awarded` | `score: Number(total_brnd_awarded)` | No 1e18 normalization. | Inconsistent with token amount paths |
| `src/lib/gemini.ts` generated SQL prompt | SQL over indexer `points` | Query result `score` | Tells SQL to divide by `1e18` and cast to bigint. | Separate SQL-layer normalizer |

### Vote Weights Defined

| File / function | Input | Output | Weights | Notes |
| --- | --- | --- | --- | --- |
| `src/lib/seasons/adapters/indexer.ts` `getLiveWeeklyLeaderboard` | Raw `votes.brand_ids` array | Weekly leaderboard points | Gold `100`, silver `50`, bronze `25` | Active round live path |
| `src/app/api/dashboard/podium-analytics/route.ts` | Raw `votes.brand_ids` by day | Momentum/share analytics | Gold `3`, silver `2`, bronze `1` | Analytics-only, not same as leaderboard |
| `src/app/api/intelligence/brand-evolution/route.ts` | Raw `votes.brand_ids` | Cumulative chart values | Gold `3`, silver `2`, bronze `1` | Chart-only, not same as leaderboard |
| `scripts/update-rankings.js` | MySQL `user_brand_votes` | Ranking SQL output | Counts podium appearances only | No point weights; sorts by total podiums |
| Indexer materialized tables | External to repo implementation | `points`, medal counts | Not defined in repo | Onchain/indexer formula inferred only from stored results |

### Leaderboard Totals Computed

| File / function | Input | Output | Math |
| --- | --- | --- | --- |
| `src/lib/seasons/adapters/indexer.ts` historical weekly | Indexer weekly table | `points`, `gold`, `silver`, `bronze`, `totalVotes` | `totalVotes = gold + silver + bronze`; points from table |
| `src/lib/seasons/adapters/indexer.ts` live weekly | Raw votes | `points`, medals, totalVotes | Aggregates medals and weighted points `100/50/25` |
| `src/lib/seasons/adapters/indexer-brands.ts` all-time brand list | Indexer all-time + S1 snapshot | `allTimePoints` | `pointsS1 + pointsS2` |
| `src/lib/seasons/adapters/indexer-users.ts` all-time user list | Indexer all-time/user + S1 snapshot | `points` | `pointsS1 + pointsS2` |
| `src/lib/seasons/adapters/mysql.ts` S1 weekly | MySQL `scoreWeek` + vote counts | weekly S1 leaderboard | Points from `scoreWeek`; counts queried separately |
| `src/lib/dashboard/stats.ts` trending | Indexer weekly medal counts | thisWeek/lastWeek/growth | Uses medal count totals, not points |
| `scripts/generate-s1-snapshot.ts` / mysql2 | MySQL historical votes and scores | static top lists and baseline JSON | Scores from MySQL; medal counts counted separately |

## Normalization Rules

### Rule A: Threshold-Aware 1e18 Conversion

Used in:

- `src/lib/seasons/adapters/indexer.ts`
- `src/lib/seasons/adapters/indexer-users.ts`

Behavior:

1. `null`/`undefined` -> `0`.
2. JavaScript `number` -> returned unchanged.
3. `bigint` or string/Decimal converted to integer string.
4. If value `< 1_000_000_000_000`, return as unscaled number.
5. Otherwise divide by `10^18`; return `Number(whole) + Number(frac) / 1e18`.
6. Throws if whole part exceeds `Number.MAX_SAFE_INTEGER`.

Implication: values below the threshold are treated as already normalized. This is a compatibility rule for mixed scaled/unscaled data.

### Rule B: Always 1e18 Conversion

Used in:

- `src/lib/seasons/adapters/indexer-brands.ts`

Behavior:

1. `null`/`undefined` -> `0`.
2. JavaScript `number` -> returned unchanged.
3. Decimal converted with `toFixed(0)`, then `BigInt`.
4. Always divide by `10^18`.
5. Throws if whole part exceeds `Number.MAX_SAFE_INTEGER`.

Implication: an unscaled Decimal value such as `100` becomes `0.0000000000000001`. This differs from Rule A.

### Rule C: Ad Hoc Number Division

Used in:

- `src/app/dashboard/brands/[id]/page.tsx` weekly history: `Math.round(Number(w.points) / 1e18)`.
- `src/app/dashboard/brands/[id]/page.tsx` withdrawals: `(Number(withdrawal.amount) / 1e18).toFixed(4)`.
- `src/lib/gemini.ts` SQL examples: `(w.points::numeric / 1e18)::bigint`.

Implication: direct `Number(...)` conversion can lose precision before scaling, especially for `DECIMAL(78,0)`.

### Rule D: String Token Formatting

Used in:

- `src/lib/seasons/adapters/indexer-collectibles.ts`

Behavior:

1. Decimal/number/string becomes integer string.
2. `BigInt` divides by `10^18`.
3. Returns a formatted string with fixed fractional slice precision.

Implication: collectible prices avoid returning JS floating point numbers, which is safer than several score paths.

## Inconsistent Normalization Rules

- `indexer.ts` and `indexer-users.ts` use threshold-aware scaling; `indexer-brands.ts` always scales. This can produce different results for the same raw `DECIMAL(78,0)` input if indexer values are unscaled or mixed.
- Brand detail weekly history uses `Math.round(Number(points) / 1e18)`, which can disagree with BigInt-based conversion on fractional values and unsafe integers.
- Intelligence prompt SQL truncates by casting divided values to `bigint`; runtime adapters preserve fractional BRND via `Number(frac) / 1e18`.
- `src/lib/intelligence/schema.ts` says “For large decimals use: `points::numeric` or `ROUND(points::numeric, 2)`,” while `src/lib/gemini.ts` says points/amounts should always be divided by `1e18`.
- Brand evolution and podium analytics use `3/2/1` raw vote scores, while live weekly leaderboard uses `100/50/25`.
- Dashboard trending uses medal-count totals instead of score totals.

## Magic Numbers And Thresholds

| Value | Location | Meaning |
| --- | --- | --- |
| `10^18` / `1e18` | Indexer normalizers, brand detail, Gemini SQL, collectibles | BRND/token decimal scale |
| `1_000_000_000_000` | `indexer.ts`, `indexer-users.ts` | Threshold below which points are treated as already unscaled |
| `100`, `50`, `25` | `IndexerAdapter.getLiveWeeklyLeaderboard` | Live weekly gold/silver/bronze weights |
| `3`, `2`, `1` | Podium analytics and brand evolution API | Analytics/evolution weights |
| `1765545180` | `src/lib/seasons/adapters/indexer.ts` | S2 week 1 timestamp |
| `604800` | `src/lib/seasons/adapters/indexer.ts` | Seconds per week |
| `2025-12-11` / `2025-12-12` | S1 snapshot scripts | S1 cutoff and S2 first day |
| `60_000`, `300_000`, `5 * 60_000` | caches/materialization | cache TTLs and refresh intervals |

## Float / BigInt / String Conversion Risks

### Observed Risk Areas

- `Number(decimal)` on indexer `DECIMAL(78,0)` appears in brand detail weekly history, withdrawals, timestamps, analytics, and evolution paths.
- `Number(value)` on bigint exists in public leaderboard response helpers and frontend helpers. This is fine for small counts but unsafe for 78-digit token amounts.
- `Number(frac) / 1e18` converts the fractional part of a 1e18-scaled BigInt into a floating point number. The resulting display number is approximate.
- Materialized Turso tables store combined points as `REAL`, so exact integer/token precision is not preserved.
- Static S1 snapshots require finite JS numbers, so they cannot preserve values beyond `Number.MAX_SAFE_INTEGER`.
- `src/lib/intelligence/query/route.ts` serializes BigInt to string, but other numeric-like values returned from SQL can remain strings or numbers depending on the driver/query.

### Lower-Risk Patterns

- `src/lib/seasons/adapters/indexer-collectibles.ts` formats token amounts as strings after BigInt division.
- `src/lib/seasons/s1-baseline.ts` validates that S1 snapshot values are finite numbers and keys are numeric strings.

## Duplicated Aggregation Pipelines

| Pipeline | Purpose | Duplicates / differences |
| --- | --- | --- |
| `IndexerAdapter.getLiveWeeklyLeaderboard` | Current weekly leaderboard from raw indexer votes | Uses `100/50/25`, active round only |
| Indexer `weekly_brand_leaderboard` read path | Historical or non-live weekly leaderboard | Uses precomputed indexer points and ranks |
| `getIndexerBrands` all-time path | Brand all-time admin list | Rebuilds `S1 + S2` at read time; does not use brand materialized cache |
| `refreshBrandsLeaderboardMaterialized` | Brand all-time Turso materialization | Computes same `S1 + S2`, but no caller found |
| `refreshUsersLeaderboardMaterialized` | User all-time Turso materialization | Active for `sortBy=points` users list |
| `src/app/api/dashboard/podium-analytics/route.ts` | Momentum/share analytics | Raw vote aggregation with `3/2/1` and count ratios |
| `src/app/api/intelligence/brand-evolution/route.ts` | Cumulative brand chart | Raw vote aggregation with `3/2/1` |
| S1 snapshot scripts | Historical S1 summaries | Read MySQL scores and count medals; do not recompute score from weights |
| `scripts/update-rankings.js` | Legacy manual rankings | Counts podiums only; does not compute score |

## Live Vs Materialized / Cache Logic

### Public Weekly Leaderboard

- `src/app/api/leaderboard/route.ts` caches the default leaderboard for 300 seconds with `unstable_cache`.
- The default active-season adapter call can itself choose live aggregation for the current round.
- When a `round` query param is provided, the API bypasses the 300-second cache and calls the active adapter directly.
- `src/components/dashboard/LiveLeaderboard.tsx` refreshes every 300 seconds from `/api/leaderboard`.

### Indexer Weekly Materialized Tables

- Historical weekly reads use `weekly_brand_leaderboard` rows ordered by `points`.
- If requested/current round is current, `IndexerAdapter.getWeeklyBrandLeaderboard` prefers live raw-vote aggregation instead of the weekly materialized table.
- Result: current round can differ from indexer materialized weekly rows until both aggregation formulas and update timing align.

### All-Time Brand Materialization

- `leaderboard_brands_alltime` schema and refresh code exist in `src/lib/seasons/adapters/indexer-brands.ts` and `scripts/migrate-turso.ts`.
- No runtime call to `ensureBrandsLeaderboardMaterialized()` was found.
- Current all-time brand list computes from indexer + S1 snapshot at read time.

### All-Time User Materialization

- `leaderboard_users_alltime` is created/refreshed in `src/lib/seasons/adapters/indexer-users.ts`.
- `getIndexerUsers({ sortBy: "points" })` actively calls `ensureUsersLeaderboardMaterialized()` and reads from Turso.
- TTL is 60 seconds.

## Read-Time Vs Write-Time Aggregation

### Read-Time

- Active weekly leaderboard from raw votes.
- All-time brand list and brand detail `S1 + S2` composition.
- Non-points user sorts in `getIndexerUsers`.
- Dashboard stats and analytics endpoints.
- Intelligence generated SQL queries.

### Write-Time / Precomputed

- Indexer tables: `weekly_brand_leaderboard`, `daily_brand_leaderboard`, `monthly_brand_leaderboard`, `all_time_*_leaderboard`.
- S1 static snapshots generated by scripts.
- Turso `leaderboard_users_alltime` materialized cache.
- Turso `leaderboard_brands_alltime` materialized cache exists but appears unused.

## Fallback Scoring Paths

- If `INDEXER_DISABLED=true`, indexer adapter methods generally return empty data rather than falling back to S1.
- `MySQLAdapter` remains available for Season 1, but the active season registry will use it only when Season 1 is active.
- S1 snapshots provide baseline points for combined all-time lists even when MySQL is disabled.
- Metadata fallbacks do not affect points, but can affect displayed leaderboard rows.
- Intelligence queries depend on generated SQL; the prompt encourages scaling, but user-generated/AI-generated SQL may still select raw decimals.

## Unresolved Uncertainty

- Whether indexer leaderboard `points` are guaranteed to be 1e18-scaled in every table and environment.
- Why threshold-aware normalizers exist in some files if the schema and Gemini prompt imply all indexer `points` are scaled.
- Whether live weekly weights `100/50/25` exactly match the contract/indexer weekly leaderboard formula.
- Whether analytics weights `3/2/1` are intentionally separate from leaderboard scoring or legacy placeholders.
- Whether S1 `brands.score` and `users.points` were generated with the same conceptual weights as S2.
- Whether Turso `leaderboard_brands_alltime` is planned, deprecated, or accidentally disconnected.
- Whether fractional BRND points should be preserved or rounded/truncated for UI and intelligence outputs.

## Highest-Risk Areas For Future Regressions

- `src/lib/seasons/adapters/indexer.ts`: changing live weekly math can alter public leaderboard behavior immediately.
- `src/lib/seasons/adapters/indexer-brands.ts`: all-time brand totals and rankings depend on local normalization, S1 snapshot alignment, and indexer id matching.
- `src/lib/seasons/adapters/indexer-users.ts`: active materialized user all-time table can drift from direct indexer reads if normalization or TTL behavior changes.
- `src/app/dashboard/brands/[id]/page.tsx`: weekly history and withdrawal displays use ad hoc `Number(...) / 1e18` conversions.
- `src/lib/gemini.ts` and `src/lib/intelligence/schema.ts`: inconsistent SQL guidance can produce raw or truncated leaderboard values.
- `scripts/generate-s1-snapshot.ts` and `scripts/generate-s1-snapshot-mysql2.ts`: S1 baseline values are the permanent additive base for all-time scoring.
- Any future change touching `points`, `score`, `scoreWeek`, `brand_ids`, `gold_count`, `silver_count`, or `bronze_count` should first identify whether it is leaderboard scoring, analytics scoring, token amount display, or legacy S1 scoring.

## Minimal Review Checklist For Future Changes

- Confirm whether input values are raw integer scores, 1e18-scaled token amounts, or already-normalized display numbers.
- Avoid direct `Number(...)` conversion on `DECIMAL(78,0)` unless the value is known to be small.
- Do not mix `100/50/25` leaderboard weights with `3/2/1` analytics weights without explicitly documenting the semantic difference.
- When changing all-time rankings, check both read-time brand math and materialized user math.
- When changing intelligence SQL prompts, keep `src/lib/gemini.ts` and `src/lib/intelligence/schema.ts` consistent.
