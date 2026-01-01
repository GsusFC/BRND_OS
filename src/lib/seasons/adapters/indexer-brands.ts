import prismaIndexer from "@/lib/prisma-indexer"
import turso from "@/lib/turso"
import { incrementCounter, recordLatency } from "@/lib/metrics"
import { getBrandsMetadata } from "../enrichment/brands"
import { Decimal } from "@prisma/client/runtime/library"
import { getS1BrandScoreById, getS1BrandScoreMap } from "../s1-baseline"
import assert from "node:assert"

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS

const INDEXER_WEEK_CACHE_TTL_MS = 60_000
let cachedIndexerWeekKey: number | null = null
let cachedIndexerWeekKeyAtMs = 0

const toIntegerOrNull = (value: Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const str = value.toFixed(0)
  if (!/^[0-9]+$/.test(str)) return null
  const num = Number(str)
  return Number.isFinite(num) ? num : null
}

const getCurrentIndexerWeekKey = async (): Promise<number | null> => {
  const nowMs = Date.now()
  if (cachedIndexerWeekKey !== null && nowMs - cachedIndexerWeekKeyAtMs < INDEXER_WEEK_CACHE_TTL_MS) {
    return cachedIndexerWeekKey
  }

  const row = await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
    orderBy: { week: "desc" },
    select: { week: true },
  })

  const weekKey = toIntegerOrNull(row?.week)
  cachedIndexerWeekKey = weekKey
  cachedIndexerWeekKeyAtMs = nowMs
  return weekKey
}

const MATERIALIZED_TTL_MS = 60_000
const BRANDS_ALLTIME_CACHE_KEY = "leaderboard:brands:alltime:v1"

let refreshBrandsLeaderboardPromise: Promise<void> | null = null

async function refreshBrandsLeaderboardMaterialized(nowMs: number): Promise<void> {
  const startMs = Date.now()
  let ok = false

  const [leaderboardRows, s1ScoreMap] = await Promise.all([
    prismaIndexer.indexerAllTimeBrandLeaderboard.findMany({
      select: {
        brand_id: true,
        points: true,
        gold_count: true,
        silver_count: true,
        bronze_count: true,
      },
    }),
    getS1BrandScoreMap(),
  ])

  try {
    await turso.execute("DELETE FROM leaderboard_brands_alltime")

    const chunkSize = 200
    const updatedAtMs = nowMs

    for (let i = 0; i < leaderboardRows.length; i += chunkSize) {
      const chunk = leaderboardRows.slice(i, i + chunkSize)

      const valuesSql = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")
      const args = chunk.flatMap((row) => {
        const pointsS1 = s1ScoreMap.get(row.brand_id) ?? 0
        const pointsS2 = normalizeIndexerPoints(row.points)
        const allTimePoints = pointsS1 + pointsS2

        return [
          row.brand_id,
          allTimePoints,
          pointsS1,
          pointsS2,
          row.gold_count,
          row.silver_count,
          row.bronze_count,
          updatedAtMs,
        ]
      })

      await turso.execute({
        sql: `INSERT INTO leaderboard_brands_alltime (brandId, allTimePoints, pointsS1, pointsS2, goldCount, silverCount, bronzeCount, updatedAtMs)
              VALUES ${valuesSql}
              ON CONFLICT(brandId) DO UPDATE SET allTimePoints=excluded.allTimePoints, pointsS1=excluded.pointsS1, pointsS2=excluded.pointsS2, goldCount=excluded.goldCount, silverCount=excluded.silverCount, bronzeCount=excluded.bronzeCount, updatedAtMs=excluded.updatedAtMs`,
        args,
      })
    }

    const expiresAtMs = nowMs + MATERIALIZED_TTL_MS
    await turso.execute({
      sql: `INSERT INTO leaderboard_materialization_meta (key, expiresAtMs, updatedAtMs)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET expiresAtMs=excluded.expiresAtMs, updatedAtMs=excluded.updatedAtMs`,
      args: [BRANDS_ALLTIME_CACHE_KEY, expiresAtMs, nowMs],
    })

    ok = true
  } finally {
    await recordLatency("cache.refresh.leaderboard_brands_alltime", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("cache.refresh_error.leaderboard_brands_alltime")
  }
}

async function ensureBrandsLeaderboardMaterialized(): Promise<void> {
  const nowMs = Date.now()
  const meta = await turso.execute({
    sql: "SELECT expiresAtMs FROM leaderboard_materialization_meta WHERE key = ? LIMIT 1",
    args: [BRANDS_ALLTIME_CACHE_KEY],
  })

  const expiresAtMsRaw = meta.rows[0]?.expiresAtMs
  const expiresAtMs = expiresAtMsRaw === undefined ? 0 : Number(expiresAtMsRaw)

  if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
    await incrementCounter("cache.hit.leaderboard_brands_alltime")
    return
  }

  await incrementCounter("cache.miss.leaderboard_brands_alltime")

  if (refreshBrandsLeaderboardPromise) {
    await incrementCounter("cache.wait.leaderboard_brands_alltime")
    await refreshBrandsLeaderboardPromise
    return
  }

  refreshBrandsLeaderboardPromise = (async () => {
    try {
      await refreshBrandsLeaderboardMaterialized(nowMs)
    } finally {
      refreshBrandsLeaderboardPromise = null
    }
  })()

  await refreshBrandsLeaderboardPromise
}

function normalizeIndexerPoints(raw: Decimal | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === "number") return raw

  const str = raw.toFixed(0)
  if (!/^[0-9]+$/.test(str)) {
    throw new Error(`Invalid indexer points value: ${str}`)
  }

  const value = BigInt(str)
  const whole = value / BRND_SCALE
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Indexer points overflow: ${whole.toString()}`)
  }

  const frac = value % BRND_SCALE
  return Number(whole) + Number(frac) / 1e18
}

export interface IndexerBrandWithMetrics {
  id: number
  name: string
  imageUrl: string | null
  channel: string | null
  // Onchain data
  handle: string
  totalBrndAwarded: number
  availableBrnd: number
  // Leaderboard metrics
  allTimePoints: number
  allTimeRank: number | null
  goldCount: number
  silverCount: number
  bronzeCount: number
  weeklyPoints: number
  weeklyRank: number | null
}

export interface IndexerBrandsResult {
  brands: IndexerBrandWithMetrics[]
  totalCount: number
  page: number
  pageSize: number
}

interface GetIndexerBrandsOptions {
  page?: number
  pageSize?: number
  sortBy?: "allTimePoints" | "weeklyPoints" | "goldCount" | "id"
  sortOrder?: "asc" | "desc"
  query?: string
}

/**
 * Get brands from Indexer with MySQL metadata enrichment
 */
export async function getIndexerBrands(options: GetIndexerBrandsOptions = {}): Promise<IndexerBrandsResult> {
  const startMs = Date.now()
  let ok = false

  try {
    const {
      page = 1,
      pageSize = 10,
      sortBy = "allTimePoints",
      sortOrder = "desc",
      query,
    } = options

    const offset = (page - 1) * pageSize

    // Get all-time leaderboard sorted
    const orderByMap: Record<string, object> = {
      allTimePoints: { points: sortOrder },
      goldCount: { gold_count: sortOrder },
      id: { brand_id: sortOrder },
    }
    const orderBy = orderByMap[sortBy] || { points: "desc" }

    // For query, search by brand_id
    const whereClause = query && !isNaN(Number(query))
      ? { brand_id: Number(query) }
      : undefined

    if (sortBy === "allTimePoints" && !whereClause) {
      await ensureBrandsLeaderboardMaterialized()

      const sqlOrder = sortOrder === "asc" ? "ASC" : "DESC"
      const [countResult, pageResult] = await Promise.all([
        turso.execute("SELECT COUNT(*) as totalCount FROM leaderboard_brands_alltime"),
        turso.execute({
          sql: `SELECT brandId, allTimePoints, pointsS1, pointsS2, goldCount, silverCount, bronzeCount
                FROM leaderboard_brands_alltime
                ORDER BY allTimePoints ${sqlOrder}
                LIMIT ? OFFSET ?`,
          args: [pageSize, offset],
        }),
      ])

      const totalCountRaw = countResult.rows[0]?.totalCount
      const totalCount = totalCountRaw === undefined ? 0 : Number(totalCountRaw)
      assert(Number.isFinite(totalCount) && totalCount >= 0, "Invalid totalCount from leaderboard_brands_alltime")

      const pageSlice = pageResult.rows.map((row, index) => {
        const brandId = Number(row.brandId)
        const allTimePoints = Number(row.allTimePoints)
        const pointsS1 = Number(row.pointsS1)
        const pointsS2 = Number(row.pointsS2)
        const goldCount = Number(row.goldCount)
        const silverCount = Number(row.silverCount)
        const bronzeCount = Number(row.bronzeCount)

        assert(Number.isInteger(brandId) && brandId > 0, "Invalid brandId from leaderboard_brands_alltime")
        assert(Number.isFinite(allTimePoints), "Invalid allTimePoints from leaderboard_brands_alltime")
        assert(Number.isFinite(pointsS1), "Invalid pointsS1 from leaderboard_brands_alltime")
        assert(Number.isFinite(pointsS2), "Invalid pointsS2 from leaderboard_brands_alltime")
        assert(Number.isFinite(goldCount), "Invalid goldCount from leaderboard_brands_alltime")
        assert(Number.isFinite(silverCount), "Invalid silverCount from leaderboard_brands_alltime")
        assert(Number.isFinite(bronzeCount), "Invalid bronzeCount from leaderboard_brands_alltime")

        return {
          brand_id: brandId,
          allTimePoints,
          pointsS1,
          pointsS2,
          goldCount,
          silverCount,
          bronzeCount,
          allTimeRank: offset + index + 1,
        }
      })

      const brandIds = pageSlice.map(r => r.brand_id)

      const currentWeekKey = await getCurrentIndexerWeekKey()

      const [onchainBrands, weeklyEntries, metadata] = await Promise.all([
        prismaIndexer.indexerBrand.findMany({ where: { id: { in: brandIds } } }),
        prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
          where: {
            brand_id: { in: brandIds },
            ...(currentWeekKey ? { week: currentWeekKey } : {}),
          },
        }),
        getBrandsMetadata(brandIds),
      ])

      const onchainMap = new Map(onchainBrands.map(b => [b.id, b]))
      const weeklyMap = new Map(weeklyEntries.map(w => [w.brand_id, w]))

      const brands: IndexerBrandWithMetrics[] = pageSlice.map(row => {
        const onchain = onchainMap.get(row.brand_id)
        const weekly = weeklyMap.get(row.brand_id)
        const meta = metadata.get(row.brand_id)

        return {
          id: row.brand_id,
          name: meta?.name ?? onchain?.handle ?? `Brand #${row.brand_id}`,
          imageUrl: meta?.imageUrl ?? null,
          channel: meta?.channel ?? null,
          handle: onchain?.handle ?? "",
          totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
          availableBrnd: Number(onchain?.available_brnd ?? 0),
          allTimePoints: row.allTimePoints,
          allTimeRank: row.allTimeRank,
          goldCount: row.goldCount,
          silverCount: row.silverCount,
          bronzeCount: row.bronzeCount,
          weeklyPoints: normalizeIndexerPoints(weekly?.points),
          weeklyRank: weekly?.rank ?? null,
        }
      })

      ok = true
      return {
        brands,
        totalCount,
        page,
        pageSize,
      }
    }

    const [totalCount, leaderboardEntries] = await Promise.all([
      prismaIndexer.indexerAllTimeBrandLeaderboard.count({ where: whereClause }),
      prismaIndexer.indexerAllTimeBrandLeaderboard.findMany({
        where: whereClause,
        orderBy,
        skip: offset,
        take: pageSize,
      }),
    ])

    const brandIds = leaderboardEntries.map(e => e.brand_id)

    const s1ScoreMap = await getS1BrandScoreMap()

    // Get onchain brand data
    const onchainBrands = await prismaIndexer.indexerBrand.findMany({
      where: { id: { in: brandIds } },
    })
    const onchainMap = new Map(onchainBrands.map(b => [b.id, b]))

    // Get weekly leaderboard for current week
    const currentWeekKey = await getCurrentIndexerWeekKey()
    const weeklyEntries = currentWeekKey
      ? await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
          where: {
            brand_id: { in: brandIds },
            week: currentWeekKey,
          },
        })
      : []
    const weeklyMap = new Map(weeklyEntries.map(w => [w.brand_id, w]))

    // Enrich with MySQL metadata
    const metadata = await getBrandsMetadata(brandIds)

    // Build result
    const brands: IndexerBrandWithMetrics[] = leaderboardEntries.map(entry => {
      const onchain = onchainMap.get(entry.brand_id)
      const weekly = weeklyMap.get(entry.brand_id)
      const meta = metadata.get(entry.brand_id)

      const pointsS1 = s1ScoreMap.get(entry.brand_id) ?? 0
      const pointsS2 = normalizeIndexerPoints(entry.points)

      return {
        id: entry.brand_id,
        name: meta?.name ?? onchain?.handle ?? `Brand #${entry.brand_id}`,
        imageUrl: meta?.imageUrl ?? null,
        channel: meta?.channel ?? null,
        handle: onchain?.handle ?? "",
        totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
        availableBrnd: Number(onchain?.available_brnd ?? 0),
        allTimePoints: pointsS1 + pointsS2,
        allTimeRank: entry.rank,
        goldCount: entry.gold_count,
        silverCount: entry.silver_count,
        bronzeCount: entry.bronze_count,
        weeklyPoints: normalizeIndexerPoints(weekly?.points),
        weeklyRank: weekly?.rank ?? null,
      }
    })

    ok = true
    return {
      brands,
      totalCount,
      page,
      pageSize,
    }
  } finally {
    await recordLatency("indexer.brands.list", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("indexer.brands.list.error")
  }
}

/**
 * Get a single brand by ID with full metrics
 */
export async function getIndexerBrandById(brandId: number): Promise<IndexerBrandWithMetrics | null> {
  const startMs = Date.now()
  let ok = false

  try {
    const [onchain, allTime, metadata, pointsS1] = await Promise.all([
      prismaIndexer.indexerBrand.findUnique({ where: { id: brandId } }),
      prismaIndexer.indexerAllTimeBrandLeaderboard.findUnique({ where: { brand_id: brandId } }),
      getBrandsMetadata([brandId]),
      getS1BrandScoreById(brandId),
    ])

    if (!allTime && !onchain) {
      ok = true
      return null
    }

    const currentWeekKey = await getCurrentIndexerWeekKey()
    const weekly = currentWeekKey
      ? await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
          where: { brand_id: brandId, week: currentWeekKey },
        })
      : null

    const meta = metadata.get(brandId)

    const pointsS2 = normalizeIndexerPoints(allTime?.points)

    const allTimeRank = allTime?.rank ?? (allTime?.points
      ? (await prismaIndexer.indexerAllTimeBrandLeaderboard.count({
          where: { points: { gt: allTime.points } },
        })) + 1
      : null)

    const weeklyRank = weekly?.rank ?? (weekly?.points && currentWeekKey
      ? (await prismaIndexer.indexerWeeklyBrandLeaderboard.count({
          where: {
            week: currentWeekKey,
            points: { gt: weekly.points },
          },
        })) + 1
      : null)

    ok = true
    return {
      id: brandId,
      name: meta?.name ?? onchain?.handle ?? `Brand #${brandId}`,
      imageUrl: meta?.imageUrl ?? null,
      channel: meta?.channel ?? null,
      handle: onchain?.handle ?? "",
      totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
      availableBrnd: Number(onchain?.available_brnd ?? 0),
      allTimePoints: pointsS1 + pointsS2,
      allTimeRank,
      goldCount: allTime?.gold_count ?? 0,
      silverCount: allTime?.silver_count ?? 0,
      bronzeCount: allTime?.bronze_count ?? 0,
      weeklyPoints: normalizeIndexerPoints(weekly?.points),
      weeklyRank,
    }
  } finally {
    await recordLatency("indexer.brands.by_id", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("indexer.brands.by_id.error")
  }
}
