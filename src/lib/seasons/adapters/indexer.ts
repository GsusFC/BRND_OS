/**
 * Adaptador Indexer para Season 2
 * Fuente de datos: Postgres indexer (prismaIndexer)
 */

import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "../enrichment/brands"
import { getUsersMetadata } from "../enrichment/users"
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
 * Obtiene el timestamp de inicio de la semana actual (el Indexer usa timestamps como week)
 * El valor en DB es el timestamp del inicio de la semana en segundos
 */
function getCurrentWeekTimestamp(): number {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const secondsPerWeek = 7 * 24 * 60 * 60
  return Math.floor(nowSeconds / secondsPerWeek) * secondsPerWeek
}

export const IndexerAdapter: SeasonAdapter = {
  async getWeeklyBrandLeaderboard(limit = 10): Promise<LeaderboardResponse> {
    const currentWeekTs = getCurrentWeekTimestamp()

    const leaderboard = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
      where: { week: currentWeekTs },
      orderBy: { points: "desc" },
      take: limit,
    })

    // Enrich with brand metadata from MySQL
    const brandIds = leaderboard.map((e) => e.brand_id)
    const brandsMetadata = await getBrandsMetadata(brandIds)

    const data: LeaderboardBrand[] = leaderboard.map((entry, index) => {
      const meta = brandsMetadata.get(entry.brand_id)
      return {
        id: entry.brand_id,
        name: meta?.name ?? `Brand #${entry.brand_id}`,
        imageUrl: meta?.imageUrl ?? null,
        channel: meta?.channel ?? null,
        points: Number(entry.points),
        gold: entry.gold_count,
        silver: entry.silver_count,
        bronze: entry.bronze_count,
        totalVotes: entry.gold_count + entry.silver_count + entry.bronze_count,
        rank: entry.rank ?? index + 1,
      }
    })

    return {
      data,
      seasonId: SEASON_ID,
      roundNumber: 1,
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

    // Enrich with user metadata from Neynar cache
    const fids = votes.map((v) => v.fid)
    const usersMetadata = await getUsersMetadata(fids)

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
      const userMeta = usersMetadata.get(vote.fid)

      return {
        id: vote.id,
        date: new Date(timestampMs),
        fid: vote.fid,
        username: userMeta?.username ?? userMeta?.displayName ?? null,
        userPhoto: userMeta?.pfpUrl ?? null,
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

    // Enrich with user metadata from Neynar cache
    const fids = leaderboard.map((e) => e.fid)
    const usersMetadata = await getUsersMetadata(fids)

    // Get vote counts from IndexerUser
    const users = await prismaIndexer.indexerUser.findMany({
      where: { fid: { in: fids } },
      select: { fid: true, total_votes: true },
    })
    const votesMap = new Map(users.map((u) => [u.fid, u.total_votes]))

    return {
      data: leaderboard.map((entry, index) => {
        const userMeta = usersMetadata.get(entry.fid)
        return {
          fid: entry.fid,
          username: userMeta?.username ?? userMeta?.displayName ?? null,
          photoUrl: userMeta?.pfpUrl ?? null,
          points: Number(entry.points),
          totalVotes: votesMap.get(entry.fid) ?? 0,
          rank: entry.rank ?? index + 1,
        }
      }),
      seasonId: SEASON_ID,
      updatedAt: new Date().toISOString(),
    }
  },
}

export default IndexerAdapter
