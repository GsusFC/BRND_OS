import prismaIndexer from "@/lib/prisma-indexer"
import { Prisma } from "@prisma/client-indexer"
import { SeasonRegistry } from "../registry"

export interface IndexerStats {
  totalUsers: number
  totalBrands: number
  totalVotes: number
  votesToday: number
  votesThisWeek: number
  activeUsersWeek: number
  seasonId: number
  roundNumber: number
  dataSource: "indexer"
}

/**
 * Get dashboard stats from the Indexer (Season 2 onchain data)
 */
export async function getIndexerStats(): Promise<IndexerStats> {
  const activeSeason = SeasonRegistry.getActiveSeason()
  const currentRound = SeasonRegistry.getCurrentRound()

  if (!activeSeason) {
    throw new Error("No active season found")
  }

  if (activeSeason.dataSource !== "indexer") {
    throw new Error(`Active season ${activeSeason.id} is not indexer`)
  }
  
  // Calculate day boundaries based on indexer's day system
  // Day 0 = Season 2 start (2025-01-12T18:12:37.000Z)
  const msPerDay = 24 * 60 * 60 * 1000
  const currentDay = Math.floor(Date.now() / msPerDay)
  const weekStartDay = Math.max(0, currentDay - 7)

  const currentDayDecimal = new Prisma.Decimal(currentDay)
  const weekStartDayDecimal = new Prisma.Decimal(weekStartDay)

  const [
    totalUsers,
    totalBrands,
    totalVotes,
    votesToday,
    votesThisWeek,
    activeUsersWeekResult,
  ] = await Promise.all([
    // Total users who have voted
    prismaIndexer.indexerUser.count(),
    
    // Total brands registered onchain
    prismaIndexer.indexerBrand.count(),
    
    // Total votes
    prismaIndexer.indexerVote.count(),
    
    // Votes today (by day field)
    prismaIndexer.indexerVote.count({
      where: { day: currentDayDecimal }
    }),
    
    // Votes this week
    prismaIndexer.indexerVote.count({
      where: { day: { gte: weekStartDayDecimal } }
    }),
    
    // Active users this week (distinct fids)
    prismaIndexer.indexerVote.findMany({
      where: { day: { gte: weekStartDayDecimal } },
      distinct: ["fid"],
      select: { fid: true },
    }),
  ])

  return {
    totalUsers,
    totalBrands,
    totalVotes,
    votesToday,
    votesThisWeek,
    activeUsersWeek: activeUsersWeekResult.length,
    seasonId: activeSeason.id,
    roundNumber: currentRound?.roundNumber ?? 0,
    dataSource: "indexer",
  }
}
