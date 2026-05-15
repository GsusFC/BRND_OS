import assert from "node:assert/strict"
import { test } from "node:test"
import { Decimal } from "@prisma/client/runtime/library"
import {
    aggregateLiveWeeklyBrandStats,
    LIVE_WEEKLY_VOTE_WEIGHTS,
    normalizeAlwaysScaledIndexerPoints as normalizeBrandIndexerPoints,
    normalizeThresholdIndexerPoints as normalizeSeasonIndexerPoints,
    normalizeThresholdIndexerPoints as normalizeUserIndexerPoints,
} from "../lib/seasons/score-normalization"

const scaled = (whole: bigint, frac = 0n) => new Decimal((whole * 10n ** 18n + frac).toString())

test("1e18-scaled indexer points normalize to display units", () => {
    assert.equal(normalizeSeasonIndexerPoints(scaled(123n)), 123)
    assert.equal(normalizeBrandIndexerPoints(scaled(123n)), 123)
    assert.equal(normalizeUserIndexerPoints(scaled(123n)), 123)
    assert.equal(normalizeSeasonIndexerPoints(scaled(123n, 450_000_000_000_000_000n)), 123.45)
})

test("threshold-aware and always-scaled normalizers document current mixed-scale behavior", () => {
    // Invariant: the generic season/user adapters preserve small unscaled values.
    assert.equal(normalizeSeasonIndexerPoints(new Decimal("100")), 100)
    assert.equal(normalizeUserIndexerPoints(new Decimal("100")), 100)

    // Invariant: brand adapter currently assumes Decimal values are 1e18-scaled.
    assert.equal(normalizeBrandIndexerPoints(new Decimal("100")), 1e-16)
})

test("representative safe integer values normalize without integer precision loss", () => {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
    assert.equal(normalizeSeasonIndexerPoints(scaled(maxSafe)), Number.MAX_SAFE_INTEGER)
    assert.equal(normalizeBrandIndexerPoints(scaled(maxSafe)), Number.MAX_SAFE_INTEGER)
    assert.equal(normalizeUserIndexerPoints(scaled(maxSafe)), Number.MAX_SAFE_INTEGER)
})

test("overflow beyond Number.MAX_SAFE_INTEGER fails loudly", () => {
    const unsafe = scaled(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
    assert.throws(() => normalizeSeasonIndexerPoints(unsafe), /Indexer points overflow/)
    assert.throws(() => normalizeBrandIndexerPoints(unsafe), /Indexer points overflow/)
    assert.throws(() => normalizeUserIndexerPoints(unsafe), /Indexer points overflow/)
})

test("S1 and S2 all-time aggregation remains an explicit addition of normalized values", () => {
    const pointsS1 = 1_250
    const pointsS2 = normalizeBrandIndexerPoints(scaled(375n))

    assert.equal(pointsS1 + pointsS2, 1_625)
})

test("live weekly leaderboard aggregation uses stable 100/50/25 weights and ordering", () => {
    assert.deepEqual(LIVE_WEEKLY_VOTE_WEIGHTS, { gold: 100, silver: 50, bronze: 25 })

    const rows = aggregateLiveWeeklyBrandStats([
        "[1,2,3]",
        "[2,1,3]",
        "not-json",
        "[1,3,2]",
    ])

    assert.deepEqual(rows, [
        { id: 1, gold: 2, silver: 1, bronze: 0, points: 250, totalVotes: 3 },
        { id: 2, gold: 1, silver: 1, bronze: 1, points: 175, totalVotes: 3 },
        { id: 3, gold: 0, silver: 1, bronze: 2, points: 100, totalVotes: 3 },
    ])
})
