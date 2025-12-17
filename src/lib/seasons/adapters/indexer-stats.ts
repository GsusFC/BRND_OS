import prismaIndexer from "@/lib/prisma-indexer"
import { SeasonRegistry } from "../registry"
import { Decimal } from "@prisma/client-indexer/runtime/library"

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
  
  // Calculate day boundaries based on indexer's day system
  // Day 0 = Season 2 start (2025-01-12T18:12:37.000Z)
  const season2Start = new Date("2025-01-12T18:12:37.000Z")
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const currentDay = Math.floor((now.getTime() - season2Start.getTime()) / msPerDay)
  const weekStartDay = currentDay - 7

  const [
    totalUsers,
    totalBrands,
    totalVotes,
    votesToday,
    votesThisWeek,
    activeUsersResult,
  ] = await Promise.all([
    // Total users who have voted
    prismaIndexer.indexerUser.count(),
    
    // Total brands registered onchain
    prismaIndexer.indexerBrand.count(),
    
    // Total votes
    prismaIndexer.indexerVote.count(),
    
    // Votes today (by day field)
    prismaIndexer.indexerVote.count({
      where: { day: new Decimal(currentDay) }
    }),
    
    // Votes this week
    prismaIndexer.indexerVote.count({
      where: { day: { gte: new Decimal(weekStartDay) } }
    }),
    
    // Active users this week (distinct fids)
    prismaIndexer.indexerVote.groupBy({
      by: ['fid'],
      where: { day: { gte: new Decimal(weekStartDay) } }
    }),
  ])

  return {
    totalUsers,
    totalBrands,
    totalVotes,
    votesToday,
    votesThisWeek,
    activeUsersWeek: activeUsersResult.length,
    seasonId: activeSeason?.id ?? 2,
    roundNumber: currentRound?.roundNumber ?? 0,
    dataSource: "indexer",
  }
}
