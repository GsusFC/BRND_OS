/**
 * Adaptador MySQL para Season 1
 * Fuente de datos: MySQL (prisma)
 */

import prisma from "@/lib/prisma"
import type {
  SeasonAdapter,
  LeaderboardResponse,
  PodiumsResponse,
  UserLeaderboardResponse,
  LeaderboardBrand,
  PodiumVote,
} from "./types"

const SEASON_ID = 1
const MYSQL_DISABLED = process.env.MYSQL_DISABLED === "true"

export const MySQLAdapter: SeasonAdapter = {
  async getWeeklyBrandLeaderboard(limit = 10, _round?: number): Promise<LeaderboardResponse> {
    if (MYSQL_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        roundNumber: 0,
        updatedAt: new Date(),
      }
    }
    void _round
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    const brands = await prisma.brand.findMany({
      where: { banned: 0 },
      orderBy: { scoreWeek: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        channel: true,
        scoreWeek: true,
      },
    })

    const data: LeaderboardBrand[] = await Promise.all(
      brands.map(async (brand, index) => {
        const [gold, silver, bronze] = await Promise.all([
          prisma.userBrandVote.count({
            where: { brand1Id: brand.id, date: { gte: weekStart } },
          }),
          prisma.userBrandVote.count({
            where: { brand2Id: brand.id, date: { gte: weekStart } },
          }),
          prisma.userBrandVote.count({
            where: { brand3Id: brand.id, date: { gte: weekStart } },
          }),
        ])

        return {
          id: brand.id,
          name: brand.name,
          imageUrl: brand.imageUrl,
          channel: brand.channel,
          points: brand.scoreWeek ?? 0,
          gold,
          silver,
          bronze,
          totalVotes: gold + silver + bronze,
          rank: index + 1,
        }
      })
    )

    return {
      data,
      seasonId: SEASON_ID,
      roundNumber: 0,
      updatedAt: new Date(),
    }
  },

  async getRecentPodiums(limit = 10): Promise<PodiumsResponse> {
    if (MYSQL_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        updatedAt: new Date(),
      }
    }
    const votes = await prisma.userBrandVote.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            fid: true,
            username: true,
            photoUrl: true,
          },
        },
        brand1: { select: { id: true } },
        brand2: { select: { id: true } },
        brand3: { select: { id: true } },
      },
    })

    const data: PodiumVote[] = votes
      .filter((vote) => vote.user && vote.brand1 && vote.brand2 && vote.brand3)
      .map((vote) => ({
        id: vote.id.toString(),
        date: vote.date,
        fid: vote.user!.fid,
        username: vote.user!.username,
        userPhoto: vote.user!.photoUrl,
        brandIds: [vote.brand1!.id, vote.brand2!.id, vote.brand3!.id],
      }))

    return {
      data,
      seasonId: SEASON_ID,
      updatedAt: new Date(),
    }
  },

  async getUserLeaderboard(limit = 10): Promise<UserLeaderboardResponse> {
    if (MYSQL_DISABLED) {
      return {
        data: [],
        seasonId: SEASON_ID,
        updatedAt: new Date(),
      }
    }
    const users = await prisma.user.findMany({
      orderBy: { points: "desc" },
      take: limit,
      select: {
        fid: true,
        username: true,
        photoUrl: true,
        points: true,
      },
    })

    // Get vote counts separately
    const usersWithVotes = await Promise.all(
      users.map(async (user) => {
        const voteCount = await prisma.userBrandVote.count({
          where: { userId: user.fid },
        })
        return { ...user, totalVotes: voteCount }
      })
    )

    return {
      data: usersWithVotes.map((user, index) => ({
        fid: user.fid,
        username: user.username,
        photoUrl: user.photoUrl,
        points: user.points ?? 0,
        totalVotes: user.totalVotes,
        rank: index + 1,
      })),
      seasonId: SEASON_ID,
      updatedAt: new Date(),
    }
  },
}

export default MySQLAdapter
