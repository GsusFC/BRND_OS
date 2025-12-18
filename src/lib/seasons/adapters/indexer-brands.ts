import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "../enrichment/brands"
import { Decimal } from "@prisma/client/runtime/library"
import { getS1BrandScoreById, getS1BrandScoreMap } from "../s1-baseline"

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS

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
    const [totalCount, leaderboardRows, s1ScoreMap] = await Promise.all([
      prismaIndexer.indexerAllTimeBrandLeaderboard.count(),
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

    const totalsSorted = leaderboardRows
      .map(r => {
        const pointsS1 = s1ScoreMap.get(r.brand_id) ?? 0
        const pointsS2 = normalizeIndexerPoints(r.points)

        return {
          brand_id: r.brand_id,
          allTimePoints: pointsS1 + pointsS2,
          goldCount: r.gold_count,
          silverCount: r.silver_count,
          bronzeCount: r.bronze_count,
        }
      })
      .sort((a, b) => {
        if (sortOrder === "asc") return a.allTimePoints - b.allTimePoints
        return b.allTimePoints - a.allTimePoints
      })

    const pageSlice = totalsSorted
      .map((row, index) => ({ ...row, allTimeRank: index + 1 }))
      .slice(offset, offset + pageSize)

    const brandIds = pageSlice.map(r => r.brand_id)

    const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))

    const [onchainBrands, weeklyEntries, metadata] = await Promise.all([
      prismaIndexer.indexerBrand.findMany({ where: { id: { in: brandIds } } }),
      prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
        where: {
          brand_id: { in: brandIds },
          week: currentWeek,
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
  const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const weeklyEntries = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
    where: {
      brand_id: { in: brandIds },
      week: currentWeek,
    },
  })
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

  return {
    brands,
    totalCount,
    page,
    pageSize,
  }
}

/**
 * Get a single brand by ID with full metrics
 */
export async function getIndexerBrandById(brandId: number): Promise<IndexerBrandWithMetrics | null> {
  const [onchain, allTime, metadata, pointsS1] = await Promise.all([
    prismaIndexer.indexerBrand.findUnique({ where: { id: brandId } }),
    prismaIndexer.indexerAllTimeBrandLeaderboard.findUnique({ where: { brand_id: brandId } }),
    getBrandsMetadata([brandId]),
    getS1BrandScoreById(brandId),
  ])

  if (!allTime && !onchain) return null

  const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const weekly = await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
    where: { brand_id: brandId, week: currentWeek },
  })

  const meta = metadata.get(brandId)

  const pointsS2 = normalizeIndexerPoints(allTime?.points)

  return {
    id: brandId,
    name: meta?.name ?? onchain?.handle ?? `Brand #${brandId}`,
    imageUrl: meta?.imageUrl ?? null,
    channel: meta?.channel ?? null,
    handle: onchain?.handle ?? "",
    totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
    availableBrnd: Number(onchain?.available_brnd ?? 0),
    allTimePoints: pointsS1 + pointsS2,
    allTimeRank: allTime?.rank ?? null,
    goldCount: allTime?.gold_count ?? 0,
    silverCount: allTime?.silver_count ?? 0,
    bronzeCount: allTime?.bronze_count ?? 0,
    weeklyPoints: normalizeIndexerPoints(weekly?.points),
    weeklyRank: weekly?.rank ?? null,
  }
}
