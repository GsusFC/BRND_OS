import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "../enrichment/brands"

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

    return {
      id: entry.brand_id,
      name: meta?.name ?? onchain?.handle ?? `Brand #${entry.brand_id}`,
      imageUrl: meta?.imageUrl ?? null,
      channel: meta?.channel ?? null,
      handle: onchain?.handle ?? "",
      totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
      availableBrnd: Number(onchain?.available_brnd ?? 0),
      allTimePoints: Number(entry.points),
      allTimeRank: entry.rank,
      goldCount: entry.gold_count,
      silverCount: entry.silver_count,
      bronzeCount: entry.bronze_count,
      weeklyPoints: Number(weekly?.points ?? 0),
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
  const [onchain, allTime, metadata] = await Promise.all([
    prismaIndexer.indexerBrand.findUnique({ where: { id: brandId } }),
    prismaIndexer.indexerAllTimeBrandLeaderboard.findUnique({ where: { brand_id: brandId } }),
    getBrandsMetadata([brandId]),
  ])

  if (!allTime && !onchain) return null

  const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const weekly = await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
    where: { brand_id: brandId, week: currentWeek },
  })

  const meta = metadata.get(brandId)

  return {
    id: brandId,
    name: meta?.name ?? onchain?.handle ?? `Brand #${brandId}`,
    imageUrl: meta?.imageUrl ?? null,
    channel: meta?.channel ?? null,
    handle: onchain?.handle ?? "",
    totalBrndAwarded: Number(onchain?.total_brnd_awarded ?? 0),
    availableBrnd: Number(onchain?.available_brnd ?? 0),
    allTimePoints: Number(allTime?.points ?? 0),
    allTimeRank: allTime?.rank ?? null,
    goldCount: allTime?.gold_count ?? 0,
    silverCount: allTime?.silver_count ?? 0,
    bronzeCount: allTime?.bronze_count ?? 0,
    weeklyPoints: Number(weekly?.points ?? 0),
    weeklyRank: weekly?.rank ?? null,
  }
}
