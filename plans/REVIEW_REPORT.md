# Compound Engineering Review Report

**Date**: 2026-01-01
**Target**: Database Architecture & Performance
**Agents**: 🏎️ Performance Oracle, 🛡️ Data Integrity Guardian, 🏗️ Architecture Strategist

## 🏎️ Performance Oracle
*Focus: Speed, Efficiency, Scalability*

### 🚨 Critical Findings
1.  **Blocking Metrics Calls (`src/lib/metrics.ts`)**:
    -   **Issue**: The `withTiming` function `await`s `recordLatency`, which in turn `await`s `turso.execute`.
    -   **Impact**: If the Turso database (external HTTP call) is slow or times out, **your application logic will hang** just because it's trying to record a metric. Observability should never impact the critical path.
    -   **Recommendation**: Fire-and-forget metrics calls (do not `await` them in the critical path), or use a background queue.

2.  **Schema Checks at Runtime**:
    -   **Issue**: `ensureSchema` runs `CREATE TABLE IF NOT EXISTS` logic. While guarded by `isSchemaReady`, in serverless environments (Next.js Vercel/Netlify), this might run more often than expected.
    -   **Recommendation**: Move DDL (Data Definition Language) statements to a migration script, not runtime code.

### ⚠️ Improvements
-   **Indexer Queries**: The `schema.indexer.prisma` uses `Decimal` for everything (standard for EVM). Ensure `prisma-client-js` serialization of Decimals doesn't cause performance overhead on large lists (e.g. Leaderboards).

## 🛡️ Data Integrity Guardian
*Focus: Consistency, Safety, Schema*

### 🚨 Critical Findings
1.  **Dual-Schema / Dual-DB Drift Risk**:
    -   **Issue**: You have `schema.prisma` (MySQL) and `schema.write.prisma` (SQLite). The `Brand` model exists in both but with different schemas (SQLite has `onChain*` fields, MySQL has `scoreWeek` etc.).
    -   **Impact**: High risk of data inconsistency. If a brand is updated in one but not the other, the application state splits.
    -   **Recommendation**: strict "Single Source of Truth" definition. If SQLite is a queue/buffer, explicit sync logic is needed (which exists in `scripts/`, but needs to be robust).

2.  **JSON Columns (`Farcaster*Cache`)**:
    -   **Issue**: `data Json` field in MySQL.
    -   **Impact**: No DB-level enforcement of structure.
    -   **Recommendation**: Ensure `zod` schemas exist and are strictly used when reading/writing to these fields to prevent "schema rot" inside the JSON.

## 🏗️ Architecture Strategist
*Focus: Structure, Patterns, Long-term Health*

### 💡 Observations
1.  **Triple Prisma Client Pattern**:
    -   You are managing 3 separate database connections (`prisma-read`, `prisma-write`, `prisma-indexer`).
    -   **Good**: Clear separation of concerns (Legacy vs Local vs Blockchain Indexer).
    -   **Risk**: Developer confusion. "Which prisma do I import?".
    -   **Recommendation**: Consolidate exports or use strict naming conventions (which you have: `prismaRead`, `prismaWrite`, `prismaIndexer`). Keep this discipline.

2.  **Singleton Pattern**:
    -   The `globalThis` pattern in `src/lib/prisma*.ts` is implemented correctly for Next.js hot-reloading.

3.  **Metrics Implementation**:
    -   Building a custom metrics engine on Turso is "Not Invented Here" syndrome unless there's a specific reason (e.g., privacy, owning data).
    -   **Recommendation**: If scale increases, consider swapping the implementation of `recordLatency` to send to a proper TSDB or observability provider (DataDog/OpenTelemetry) instead of SQL inserts.

## Action Plan
1.  [Performance] **Refactor `src/lib/metrics.ts`** to make `recordLatency` non-blocking.
2.  [Integrity] **Audit Sync Logic**: Review `scripts/sync-categories.ts` (and similar) to ensure they handle the schema differences between `write.db` and `mysql` safely.
