import assert from "node:assert"
import turso from "@/lib/turso"

const BUCKET_MS = 60_000
const LATENCY_BUCKET_LIMITS_MS = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000] as const
const LATENCY_BUCKET_COUNT = LATENCY_BUCKET_LIMITS_MS.length + 1

type BucketCounts = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

let isSchemaReady = false
let schemaPromise: Promise<void> | null = null

const getBucketStartMs = (nowMs: number): number => Math.floor(nowMs / BUCKET_MS) * BUCKET_MS

const getLatencyBucketIndex = (durationMs: number): number => {
  if (durationMs <= 0) return 0
  for (let i = 0; i < LATENCY_BUCKET_LIMITS_MS.length; i += 1) {
    if (durationMs <= LATENCY_BUCKET_LIMITS_MS[i]) return i
  }
  return LATENCY_BUCKET_LIMITS_MS.length
}

const ensureSchema = async (): Promise<void> => {
  if (isSchemaReady) return
  if (schemaPromise) return schemaPromise

  schemaPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS metrics_latency_1m (
        bucketStartMs INTEGER NOT NULL,
        name TEXT NOT NULL,
        count INTEGER NOT NULL,
        errorCount INTEGER NOT NULL,
        sumMs REAL NOT NULL,
        maxMs REAL NOT NULL,
        b0 INTEGER NOT NULL,
        b1 INTEGER NOT NULL,
        b2 INTEGER NOT NULL,
        b3 INTEGER NOT NULL,
        b4 INTEGER NOT NULL,
        b5 INTEGER NOT NULL,
        b6 INTEGER NOT NULL,
        b7 INTEGER NOT NULL,
        b8 INTEGER NOT NULL,
        b9 INTEGER NOT NULL,
        b10 INTEGER NOT NULL,
        b11 INTEGER NOT NULL,
        b12 INTEGER NOT NULL,
        updatedAtMs INTEGER NOT NULL,
        PRIMARY KEY(bucketStartMs, name)
      )
    `)

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS metrics_counter_1m (
        bucketStartMs INTEGER NOT NULL,
        name TEXT NOT NULL,
        count INTEGER NOT NULL,
        updatedAtMs INTEGER NOT NULL,
        PRIMARY KEY(bucketStartMs, name)
      )
    `)

    isSchemaReady = true
  })()

  try {
    await schemaPromise
  } finally {
    schemaPromise = null
  }
}

export const incrementCounter = async (name: string, delta: number = 1): Promise<void> => {
  try {
    assert(typeof name === "string" && name.length > 0, "incrementCounter: name required")
    assert(Number.isFinite(delta) && Number.isInteger(delta), "incrementCounter: delta must be an integer")

    const nowMs = Date.now()
    const bucketStartMs = getBucketStartMs(nowMs)

    await ensureSchema()

    await turso.execute({
      sql: `INSERT INTO metrics_counter_1m (bucketStartMs, name, count, updatedAtMs)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(bucketStartMs, name) DO UPDATE SET
              count = count + excluded.count,
              updatedAtMs = excluded.updatedAtMs`,
      args: [bucketStartMs, name, delta, nowMs],
    })
  } catch {
    return
  }
}

export const recordLatency = async (name: string, durationMs: number, ok: boolean): Promise<void> => {
  try {
    assert(typeof name === "string" && name.length > 0, "recordLatency: name required")
    assert(Number.isFinite(durationMs) && durationMs >= 0, "recordLatency: durationMs must be a finite non-negative number")

    const nowMs = Date.now()
    const bucketStartMs = getBucketStartMs(nowMs)

    await ensureSchema()

    const idx = getLatencyBucketIndex(durationMs)
    assert(idx >= 0 && idx < LATENCY_BUCKET_COUNT, "recordLatency: invalid bucket index")

    const b: number[] = new Array(LATENCY_BUCKET_COUNT).fill(0)
    b[idx] = 1

    await turso.execute({
      sql: `INSERT INTO metrics_latency_1m (
              bucketStartMs, name, count, errorCount, sumMs, maxMs,
              b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12,
              updatedAtMs
            ) VALUES (
              ?, ?, 1, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?
            )
            ON CONFLICT(bucketStartMs, name) DO UPDATE SET
              count = count + 1,
              errorCount = errorCount + excluded.errorCount,
              sumMs = sumMs + excluded.sumMs,
              maxMs = max(maxMs, excluded.maxMs),
              b0 = b0 + excluded.b0,
              b1 = b1 + excluded.b1,
              b2 = b2 + excluded.b2,
              b3 = b3 + excluded.b3,
              b4 = b4 + excluded.b4,
              b5 = b5 + excluded.b5,
              b6 = b6 + excluded.b6,
              b7 = b7 + excluded.b7,
              b8 = b8 + excluded.b8,
              b9 = b9 + excluded.b9,
              b10 = b10 + excluded.b10,
              b11 = b11 + excluded.b11,
              b12 = b12 + excluded.b12,
              updatedAtMs = excluded.updatedAtMs`,
      args: [
        bucketStartMs,
        name,
        ok ? 0 : 1,
        durationMs,
        durationMs,
        b[0],
        b[1],
        b[2],
        b[3],
        b[4],
        b[5],
        b[6],
        b[7],
        b[8],
        b[9],
        b[10],
        b[11],
        b[12],
        nowMs,
      ],
    })
  } catch {
    return
  }
}

export const withTiming = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const startMs = Date.now()
  try {
    const result = await fn()
    await recordLatency(name, Date.now() - startMs, true)
    return result
  } catch (error) {
    await recordLatency(name, Date.now() - startMs, false)
    throw error
  }
}

export type LatencyAggregate = {
  name: string
  count: number
  errorCount: number
  errorRate: number
  avgMs: number
  maxMs: number
  p95Ms: number | null
}

const addBuckets = (a: BucketCounts, b: BucketCounts): BucketCounts => {
  const out: number[] = new Array(LATENCY_BUCKET_COUNT).fill(0)
  for (let i = 0; i < LATENCY_BUCKET_COUNT; i += 1) {
    out[i] = a[i] + b[i]
  }
  return out as BucketCounts
}

const p95FromBuckets = (b: BucketCounts, totalCount: number): number | null => {
  if (totalCount <= 0) return null

  const target = Math.ceil(totalCount * 0.95)
  let acc = 0

  for (let i = 0; i < LATENCY_BUCKET_COUNT; i += 1) {
    acc += b[i]
    if (acc >= target) {
      if (i < LATENCY_BUCKET_LIMITS_MS.length) return LATENCY_BUCKET_LIMITS_MS[i]
      return LATENCY_BUCKET_LIMITS_MS[LATENCY_BUCKET_LIMITS_MS.length - 1]
    }
  }

  return null
}

export const getLatencyAggregates = async (minutes: number): Promise<LatencyAggregate[]> => {
  assert(Number.isFinite(minutes) && minutes > 0, "getLatencyAggregates: minutes must be > 0")

  const nowMs = Date.now()
  const startMs = nowMs - minutes * BUCKET_MS

  await ensureSchema()

  const rows = await turso.execute({
    sql: `SELECT
            name,
            count,
            errorCount,
            sumMs,
            maxMs,
            b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12
          FROM metrics_latency_1m
          WHERE bucketStartMs >= ?`,
    args: [startMs],
  })

  const byName = new Map<
    string,
    { count: number; errorCount: number; sumMs: number; maxMs: number; buckets: BucketCounts }
  >()

  for (const row of rows.rows) {
    const name = String(row.name)
    const count = Number(row.count)
    const errorCount = Number(row.errorCount)
    const sumMs = Number(row.sumMs)
    const maxMs = Number(row.maxMs)

    const buckets = [
      Number(row.b0),
      Number(row.b1),
      Number(row.b2),
      Number(row.b3),
      Number(row.b4),
      Number(row.b5),
      Number(row.b6),
      Number(row.b7),
      Number(row.b8),
      Number(row.b9),
      Number(row.b10),
      Number(row.b11),
      Number(row.b12),
    ] as BucketCounts

    const prev = byName.get(name)
    if (!prev) {
      byName.set(name, { count, errorCount, sumMs, maxMs, buckets })
      continue
    }

    byName.set(name, {
      count: prev.count + count,
      errorCount: prev.errorCount + errorCount,
      sumMs: prev.sumMs + sumMs,
      maxMs: Math.max(prev.maxMs, maxMs),
      buckets: addBuckets(prev.buckets, buckets),
    })
  }

  const out: LatencyAggregate[] = []
  for (const [name, agg] of byName) {
    const avgMs = agg.count > 0 ? agg.sumMs / agg.count : 0
    const errorRate = agg.count > 0 ? agg.errorCount / agg.count : 0
    out.push({
      name,
      count: agg.count,
      errorCount: agg.errorCount,
      errorRate,
      avgMs,
      maxMs: agg.maxMs,
      p95Ms: p95FromBuckets(agg.buckets, agg.count),
    })
  }

  out.sort((a, b) => b.count - a.count)
  return out
}

export const getCounters = async (minutes: number): Promise<Record<string, number>> => {
  assert(Number.isFinite(minutes) && minutes > 0, "getCounters: minutes must be > 0")

  const nowMs = Date.now()
  const startMs = nowMs - minutes * BUCKET_MS

  await ensureSchema()

  const rows = await turso.execute({
    sql: "SELECT name, count FROM metrics_counter_1m WHERE bucketStartMs >= ?",
    args: [startMs],
  })

  const out: Record<string, number> = {}
  for (const row of rows.rows) {
    const name = String(row.name)
    out[name] = (out[name] ?? 0) + Number(row.count)
  }

  return out
}
