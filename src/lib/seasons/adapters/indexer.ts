/**
 * Adaptador Indexer para Season 2
 * Fuente de datos: Postgres indexer (prismaIndexer)
 */

import prismaIndexer from "@/lib/prisma-indexer"
import { Decimal } from "@prisma/client/runtime/library"
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

type WeeklyLeaderboardRow = {
  week?: Decimal
  brand_id: number
  points: Decimal | number | bigint | string
  gold_count: number
  silver_count: number
  bronze_count: number
  rank: number | null
}

type WeeklyLeaderboardWeek = {
  week: Decimal
}

type IndexerVoteRow = {
  id: string
  fid: number
  voter: string | null
  brand_ids: string
  timestamp: Decimal | number
  transaction_hash: string | null
}

type IndexerUserLeaderboardRow = {
  fid: number
  points: Decimal | number | bigint | string
  rank: number | null
}

type IndexerUserRow = {
  fid: number
  total_votes: number | null
}

const SEASON_ID = 2

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS
const INDEXER_POINTS_SCALED_THRESHOLD = BigInt(1_000_000_000_000)

const normalizeIndexerPoints = (raw: unknown): number => {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === "number") return raw
  if (typeof raw === "bigint") {
    if (raw < INDEXER_POINTS_SCALED_THRESHOLD) return Number(raw)
    const whole = raw / BRND_SCALE
    if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Indexer points overflow: ${whole.toString()}`)
    }
    const frac = raw % BRND_SCALE
    return Number(whole) + Number(frac) / 1e18
  }

  const input = String(raw)
  if (input.length === 0) return 0

  const normalized = new Decimal(input).toFixed(0)
  const value = BigInt(normalized)

  if (value < INDEXER_POINTS_SCALED_THRESHOLD) {
    return Number(value)
  }

  const whole = value / BRND_SCALE
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Indexer points overflow: ${whole.toString()}`)
  }
  const frac = value % BRND_SCALE
  return Number(whole) + Number(frac) / 1e18
}


// Constants for Week 1 (Friday Dec 12 2025 13:13:00 UTC)
const WEEK_1_TIMESTAMP = 1765545180
const SECONDS_IN_WEEK = 604800

/**
 * Calculate the round number based on a timestamp (seconds)
 */
const getRoundFromTimestamp = (timestamp: number): number => {
  if (timestamp < WEEK_1_TIMESTAMP) return 1
  const diff = timestamp - WEEK_1_TIMESTAMP
  return Math.floor(diff / SECONDS_IN_WEEK) + 1
}

/**
 * Get the starting timestamp for a specific round
 */
const getTimestampFromRound = (round: number): number | null => {
  if (round < 1) return null
  return WEEK_1_TIMESTAMP + (round - 1) * SECONDS_IN_WEEK
}

const INDEXER_DISABLED = process.env.INDEXER_DISABLED === "true"

export const IndexerAdapter: SeasonAdapter = {
  async getWeeklyBrandLeaderboard(limit = 10, round?: number): Promise<LeaderboardResponse> {
    if (INDEXER_DISABLED) {
      const currentRoundNum = getRoundFromTimestamp(Date.now() / 1000)
      return {
        data: [],
        seasonId: SEASON_ID,
        roundNumber: round ?? currentRoundNum,
        updatedAt: new Date(),
      }
    }

    try {

    let targetWeek: number | undefined

    if (round) {
      const timestamp = getTimestampFromRound(round)
      if (timestamp) {
        // Verify if this week exists or is valid
        targetWeek = timestamp
      }
    }

    // specific week requested or default to latest
    let weekEntry: { week: Decimal } | null = null

    if (targetWeek) {
      weekEntry = await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
        where: { week: new Decimal(targetWeek) },
        select: { week: true },
      })
    } else {
      // Get the most recent week's leaderboard
      weekEntry = await prismaIndexer.indexerWeeklyBrandLeaderboard.findFirst({
        orderBy: { week: "desc" },
        select: { week: true },
      })
    }

    const currentRoundNum = getRoundFromTimestamp(Date.now() / 1000)
    const isRequestedRoundCurrent = round === currentRoundNum || (!round && weekEntry && getRoundFromTimestamp(Number(weekEntry.week)) === currentRoundNum)

    // Si es el round actual, PREFERIR agregación live para tener datos "al momento"
    // como ha pedido el usuario.
    if (isRequestedRoundCurrent && this.getLiveWeeklyLeaderboard) {
      return this.getLiveWeeklyLeaderboard(limit, round ?? currentRoundNum)
    }

    if (!weekEntry) {
      return {
        data: [],
        seasonId: SEASON_ID,
        roundNumber: round ?? currentRoundNum,
        updatedAt: new Date(),
      }
    }

    const currentWeekTimestamp = Number(weekEntry.week)
    const roundNumber = getRoundFromTimestamp(currentWeekTimestamp)

    const leaderboard: WeeklyLeaderboardRow[] = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
      where: { week: weekEntry.week },
      orderBy: { points: "desc" },
      take: limit,
    })

    // Enrich with brand metadata from MySQL
    const brandIds = leaderboard.map((entry) => entry.brand_id)
    const brandsMetadata = await getBrandsMetadata(brandIds)

    const data: LeaderboardBrand[] = leaderboard.map((entry, index) => {
      const meta = brandsMetadata.get(entry.brand_id)
      return {
        id: entry.brand_id,
        name: meta?.name ?? `Brand #${entry.brand_id}`,
        imageUrl: meta?.imageUrl ?? null,
        channel: meta?.channel ?? null,
        points: normalizeIndexerPoints(entry.points.toString()),
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
      roundNumber: roundNumber,
      updatedAt: new Date(),
    }
    } catch (error) {
      console.error("[indexer] getWeeklyBrandLeaderboard failed:", error)
      const currentRoundNum = getRoundFromTimestamp(Date.now() / 1000)
      return {
        data: [],
        seasonId: SEASON_ID,
        roundNumber: round ?? currentRoundNum,
        updatedAt: new Date(),
      }
    }
  },

  async getAvailableRounds(): Promise<{ round: number; label: string; isCurrent: boolean }[]> {
    if (INDEXER_DISABLED) {
      return []
    }
    // Get all distinct weeks from DB to know which rounds have data
    const weeks: WeeklyLeaderboardWeek[] = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
      distinct: ['week'],
      orderBy: { week: 'desc' },
      select: { week: true }
    })

    if (!weeks.length) return []

    const currentTimestamp = Date.now() / 1000
    const currentRound = getRoundFromTimestamp(currentTimestamp)

    const rounds = weeks.map((week) => {
      const ts = Number(week.week)
      const round = getRoundFromTimestamp(ts)
      const startDate = new Date(ts * 1000)
      const endDate = new Date((ts + SECONDS_IN_WEEK) * 1000)

      const isCurrent = round === currentRound

      // Simple label formatting
      const dateRange = `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      const label = `Round ${round} (${dateRange})${isCurrent ? ' • LIVE' : ''}`

      return {
        round,
        label,
        isCurrent
      }
    })

    // Asegurar que el round actual siempre esté en la lista, incluso si no hay snapshot aún
    if (!rounds.find((roundEntry) => roundEntry.round === currentRound)) {
      const ts = getTimestampFromRound(currentRound)!
      const startDate = new Date(ts * 1000)
      const endDate = new Date((ts + SECONDS_IN_WEEK) * 1000)
      const dateRange = `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

      rounds.unshift({
        round: currentRound,
        label: `Round ${currentRound} (${dateRange}) • LIVE`,
        isCurrent: true
      })
    }

    return rounds
  },

  async getRecentPodiums(limit = 10): Promise<PodiumsResponse> {
    if (INDEXER_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        updatedAt: new Date(),
      }
    }

    let votes: IndexerVoteRow[] = []
    try {
      votes = await prismaIndexer.indexerVote.findMany({
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
    } catch (error) {
      console.error("[indexer] getRecentPodiums failed:", error)
      return {
        data: [],
        seasonId: SEASON_ID,
        updatedAt: new Date(),
      }
    }

    // Enrich with user metadata from Neynar cache
    const fids = votes.map((vote) => vote.fid)
    const usersMetadata = await getUsersMetadata(fids, { fetchMissingFromNeynar: true })

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
        transactionHash: vote.transaction_hash ?? undefined,
      }
    })

    return {
      data,
      seasonId: SEASON_ID,
      updatedAt: new Date(),
    }
  },

  async getUserLeaderboard(limit = 10): Promise<UserLeaderboardResponse> {
    if (INDEXER_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        updatedAt: new Date(),
      }
    }
    const leaderboard: IndexerUserLeaderboardRow[] = await prismaIndexer.indexerAllTimeUserLeaderboard.findMany({
      orderBy: { points: "desc" },
      take: limit,
    })

    // Enrich with user metadata from Neynar cache
    const fids = leaderboard.map((entry) => entry.fid)
    const usersMetadata = await getUsersMetadata(fids, { fetchMissingFromNeynar: false })

    // Get vote counts from IndexerUser
    const users: IndexerUserRow[] = await prismaIndexer.indexerUser.findMany({
      where: { fid: { in: fids } },
      select: { fid: true, total_votes: true },
    })
    const votesMap = new Map(users.map((user) => [user.fid, user.total_votes]))

    return {
      data: leaderboard.map((entry, index) => {
        const userMeta = usersMetadata.get(entry.fid)
        return {
          fid: entry.fid,
          username: userMeta?.username ?? userMeta?.displayName ?? null,
          photoUrl: userMeta?.pfpUrl ?? null,
          points: normalizeIndexerPoints(entry.points.toString()),
          totalVotes: votesMap.get(entry.fid) ?? 0,
          rank: entry.rank ?? index + 1,
        }
      }),
      seasonId: SEASON_ID,
      updatedAt: new Date(),
    }
  },

  /**
   * Agregación live desde raw votes para el round actual
   */
  async getLiveWeeklyLeaderboard(limit = 10, round: number): Promise<LeaderboardResponse> {
    if (INDEXER_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        roundNumber: round,
        updatedAt: new Date(),
      }
    }
    const startTime = getTimestampFromRound(round)!
    const endTime = startTime + SECONDS_IN_WEEK

    // Traer todos los votos del período
    const votes = await prismaIndexer.indexerVote.findMany({
      where: {
        timestamp: {
          gte: new Decimal(startTime),
          lt: new Decimal(endTime),
        },
      },
      select: { brand_ids: true },
    })

    // Agrupar por brand
    const brandStats = new Map<number, { gold: number; silver: number; bronze: number; points: number }>()

    for (const vote of votes) {
      try {
        const brandIds: number[] = JSON.parse(vote.brand_ids)

        // Gold (1st)
        if (brandIds[0]) {
          const stats = brandStats.get(brandIds[0]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
          stats.gold++
          stats.points += 100
          brandStats.set(brandIds[0], stats)
        }
        // Silver (2nd)
        if (brandIds[1]) {
          const stats = brandStats.get(brandIds[1]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
          stats.silver++
          stats.points += 50
          brandStats.set(brandIds[1], stats)
        }
        // Bronze (3rd)
        if (brandIds[2]) {
          const stats = brandStats.get(brandIds[2]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
          stats.bronze++
          stats.points += 25
          brandStats.set(brandIds[2], stats)
        }
      } catch {
        // Skip malformed votes
      }
    }

    // Convertir a array y sortear
    const sortedBrands = Array.from(brandStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.points - a.points || b.gold - a.gold)
      .slice(0, limit)

    // Enriquecer con metadata
    const brandIds = sortedBrands.map(b => b.id)
    const brandsMetadata = await getBrandsMetadata(brandIds)

    const data: LeaderboardBrand[] = sortedBrands.map((entry, index) => {
      const meta = brandsMetadata.get(entry.id)
      return {
        id: entry.id,
        name: meta?.name ?? `Brand #${entry.id}`,
        imageUrl: meta?.imageUrl ?? null,
        channel: meta?.channel ?? null,
        points: entry.points,
        gold: entry.gold,
        silver: entry.silver,
        bronze: entry.bronze,
        totalVotes: entry.gold + entry.silver + entry.bronze,
        rank: index + 1,
      }
    })

    return {
      data,
      seasonId: SEASON_ID,
      roundNumber: round,
      updatedAt: new Date(),
    }
  },
}

export default IndexerAdapter
