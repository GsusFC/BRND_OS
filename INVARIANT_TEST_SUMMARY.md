# Invariant Test Summary

This document summarizes the architecture-critical safety tests added for BRND_OS. It documents observed protections only; it does not propose a new architecture.

## Added Coverage

| Area | Test file | Protected invariant |
| --- | --- | --- |
| Brand identity | `src/__tests__/brand-identity-invariants.test.ts` | Farcaster profile/channel canonicalization is deterministic, ambiguous profile inputs are rejected, detail fallback precedence remains stable, and punctuation-stripped fallback keys are not safe merge identities by themselves. |
| Score normalization | `src/__tests__/score-normalization-invariants.test.ts` | 1e18-scaled values normalize consistently, mixed-scale behavior remains explicit, overflow fails loudly, S1/S2 all-time addition stays stable, and live weekly leaderboard weights/order remain fixed. |
| Permissions | `src/__tests__/permission-invariants.test.ts` | Permission helpers deny null/inactive users, full-access semantics remain explicit, sensitive dashboard paths map to narrow permissions, and dashboard middleware rejects unauthenticated or misconfigured requests server-side. |
| Intelligence SQL | `src/__tests__/intelligence-sql-invariants.test.ts` | Dangerous SQL patterns are rejected, read queries still work, `CREATE TEMPORARY TABLE` remains the only allowed DDL carve-out, and result limits are enforced. |
| Environment behavior | `src/__tests__/environment-invariants.test.ts` | Turso credentials fail loudly, Redis cache helpers degrade to fallback, and the Postgres indexer defaults to a disabled stub outside production unless explicitly enabled. |

## Minimal Supporting Runtime Utility

- `src/lib/seasons/score-normalization.ts` contains the existing pure score normalization and live weekly aggregation behavior without importing Prisma clients.

This utility is behavior-preserving and exists to test existing normalization and aggregation logic directly without requiring generated database clients.
