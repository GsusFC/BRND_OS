/**
 * Adaptador Indexer para Season 2
 * Fuente de datos: Postgres indexer (prismaIndexer)
 */

import prismaIndexer from "@/lib/prisma-indexer"
import { SeasonRegistry } from "../registry"
import type {
  SeasonAdapter,
  LeaderboardResponse,
  PodiumsResponse,
  UserLeaderboardResponse,
  LeaderboardBrand,
  PodiumVote,
} from "./types"

const SEASON_ID = 2

/**
 * Obtiene el número de semana actual desde el inicio de Season 2
 */
function getCurrentWeekNumber(): number {
  const currentRound = SeasonRegistry.getCurrentRoundNumber()
  return currentRound ?? 1
}

export const IndexerAdapter: SeasonAdapter = {
  async getWeeklyBrandLeaderboard(limit = 10): Promise<LeaderboardResponse> {
    const currentWeek = getCurrentWeekNumber()

    const leaderboard = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
      where: { week: currentWeek },
      orderBy: { points: "desc" },
      take: limit,
    })

    // TODO: Enrich with brand metadata (name, imageUrl, channel) from MySQL or cache
    const data: LeaderboardBrand[] = leaderboard.map((entry, index) => ({
      id: entry.brand_id,
      name: `Brand #${entry.brand_id}`, // Placeholder - needs enrichment
      imageUrl: null,
      channel: null,
      points: Number(entry.points),
      gold: entry.gold_count,
      silver: entry.silver_count,
      bronze: entry.bronze_count,
      totalVotes: entry.gold_count + entry.silver_count + entry.bronze_count,
      rank: entry.rank ?? index + 1,
    }))

    return {
      data,
      seasonId: SEASON_ID,
      roundNumber: currentWeek,
      updatedAt: new Date().toISOString(),
    }
  },

  async getRecentPodiums(limit = 10): Promise<PodiumsResponse> {
    const votes = await prismaIndexer.indexerVote.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        fid: true,
        voter: true,
        brand_ids: true,
        timestamp: true,
        transaction_hash: true,
      },
    })

    const data: PodiumVote[] = votes.map((vote) => {
      // Parse brand_ids from JSON string "[19,62,227]"
      let brandIds: number[] = []
      try {
        brandIds = JSON.parse(vote.brand_ids)
      } catch {
        brandIds = []
      }

      // Convert timestamp (seconds) to Date
      const timestampMs = Number(vote.timestamp) * 1000

      return {
        id: vote.id,
        date: new Date(timestampMs),
        fid: vote.fid,
        username: null, // TODO: Enrich from Neynar cache
        userPhoto: null,
        brandIds,
        transactionHash: vote.transaction_hash,
      }
    })

    return {
      data,
      seasonId: SEASON_ID,
      updatedAt: new Date().toISOString(),
    }
  },

  async getUserLeaderboard(limit = 10): Promise<UserLeaderboardResponse> {
    const leaderboard = await prismaIndexer.indexerAllTimeUserLeaderboard.findMany({
      orderBy: { points: "desc" },
      take: limit,
    })

    return {
      data: leaderboard.map((entry, index) => ({
        fid: entry.fid,
        username: null, // TODO: Enrich from Neynar cache
        photoUrl: null,
        points: Number(entry.points),
        totalVotes: 0, // TODO: Get from IndexerUser if needed
        rank: entry.rank ?? index + 1,
      })),
      seasonId: SEASON_ID,
      updatedAt: new Date().toISOString(),
    }
  },
}

export default IndexerAdapter
