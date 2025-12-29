import prismaIndexer from "@/lib/prisma-indexer"
import { Prisma } from "@prisma/client-indexer"
import { SeasonRegistry } from "../registry"
import assert from "node:assert/strict"

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
  // Day 0 = activeSeason.startAt
  const latestDayAgg = await prismaIndexer.indexerVote.aggregate({
    _max: { day: true },
  })

  const latestDay = latestDayAgg._max.day
  if (!latestDay) {
    throw new Error("No votes found in indexer")
  }

  const latestDayInt = Number(latestDay.toFixed(0))
  assert(Number.isInteger(latestDayInt) && latestDayInt >= 0, "Invalid latestDayInt")

  const currentDayDecimal = new Prisma.Decimal(latestDayInt)
  const weekStartDayDecimal = new Prisma.Decimal(Math.max(0, latestDayInt - 7))

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
