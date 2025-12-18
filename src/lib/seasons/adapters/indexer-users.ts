import prismaIndexer from "@/lib/prisma-indexer"
import { getUsersMetadata } from "../enrichment/users"
import { Decimal } from "@prisma/client/runtime/library"
import { getS1UserPointsByFid, getS1UserPointsMap } from "../s1-baseline"

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

export interface IndexerUser {
  fid: number
  username: string
  photoUrl: string | null
  points: number
  pointsS1: number
  pointsS2: number
  powerLevel: number
  totalVotes: number
  lastVoteDay: number | null
}

export interface IndexerUsersResult {
  users: IndexerUser[]
  totalCount: number
  page: number
  pageSize: number
}

interface GetIndexerUsersOptions {
  page?: number
  pageSize?: number
  sortBy?: "points" | "totalVotes" | "powerLevel" | "fid"
  sortOrder?: "asc" | "desc"
  query?: string
}

/**
 * Get users from Indexer with Farcaster enrichment
 */
export async function getIndexerUsers(options: GetIndexerUsersOptions = {}): Promise<IndexerUsersResult> {
  const {
    page = 1,
    pageSize = 10,
    sortBy = "points",
    sortOrder = "desc",
    query,
  } = options

  const offset = (page - 1) * pageSize

  // Build orderBy based on sortBy
  const orderByMap: Record<string, object> = {
    points: { points: sortOrder },
    totalVotes: { total_votes: sortOrder },
    powerLevel: { brnd_power_level: sortOrder },
    fid: { fid: sortOrder },
  }
  const orderBy = orderByMap[sortBy] || { points: "desc" }

  // For query, we need to search by fid (number) since we don't have username in indexer
  // We'll filter after enrichment if query is provided
  const whereClause = query && !isNaN(Number(query)) 
    ? { fid: Number(query) }
    : undefined

  if (sortBy === "points" && !whereClause) {
    const offset = (page - 1) * pageSize

    const [totalCount, leaderboardRows, s1PointsMap] = await Promise.all([
      prismaIndexer.indexerAllTimeUserLeaderboard.count(),
      prismaIndexer.indexerAllTimeUserLeaderboard.findMany({
        select: { fid: true, points: true },
      }),
      getS1UserPointsMap(),
    ])

    const totals = leaderboardRows
      .map(r => {
        const pointsS1 = s1PointsMap.get(r.fid) ?? 0
        const pointsS2 = normalizeIndexerPoints(r.points)
        return {
          fid: r.fid,
          pointsS1,
          pointsS2,
          points: pointsS1 + pointsS2,
        }
      })
      .sort((a, b) => {
        if (sortOrder === "asc") return a.points - b.points
        return b.points - a.points
      })

    const pageSlice = totals.slice(offset, offset + pageSize)
    const fids = pageSlice.map(r => r.fid)

    const [indexerUsers, farcasterData] = await Promise.all([
      prismaIndexer.indexerUser.findMany({
        where: { fid: { in: fids } },
      }),
      getUsersMetadata(fids),
    ])

    const indexerMap = new Map(indexerUsers.map(u => [u.fid, u]))

    const users: IndexerUser[] = pageSlice.map(row => {
      const u = indexerMap.get(row.fid)
      if (!u) {
        throw new Error(`Missing indexerUser row for fid ${row.fid}`)
      }

      const farcaster = farcasterData.get(row.fid)

      return {
        fid: row.fid,
        username: farcaster?.username ?? `fid:${row.fid}`,
        photoUrl: farcaster?.pfpUrl ?? null,
        points: row.points,
        pointsS1: row.pointsS1,
        pointsS2: row.pointsS2,
        powerLevel: u.brnd_power_level,
        totalVotes: u.total_votes,
        lastVoteDay: u.last_vote_day,
      }
    })

    return {
      users,
      totalCount,
      page,
      pageSize,
    }
  }

  const [totalCount, indexerUsers] = await Promise.all([
    prismaIndexer.indexerUser.count({ where: whereClause }),
    prismaIndexer.indexerUser.findMany({
      where: whereClause,
      orderBy,
      skip: offset,
      take: pageSize,
    }),
  ])

  // Get all fids to enrich
  const fids = indexerUsers.map(u => u.fid)
  
  // Enrich with Farcaster metadata and get S1 points from snapshot
  const [farcasterData, s1PointsMap] = await Promise.all([getUsersMetadata(fids), getS1UserPointsMap()])

  // Map to our interface
  const users: IndexerUser[] = indexerUsers.map(u => {
    const farcaster = farcasterData.get(u.fid)
    const pointsS1 = s1PointsMap.get(u.fid) ?? 0
    const pointsS2 = normalizeIndexerPoints(u.points)
    return {
      fid: u.fid,
      username: farcaster?.username ?? `fid:${u.fid}`,
      photoUrl: farcaster?.pfpUrl ?? null,
      points: pointsS1 + pointsS2,
      pointsS1,
      pointsS2,
      powerLevel: u.brnd_power_level,
      totalVotes: u.total_votes,
      lastVoteDay: u.last_vote_day,
    }
  })

  return {
    users,
    totalCount,
    page,
    pageSize,
  }
}

/**
 * Get a single user by FID from Indexer + S1 points from MySQL
 */
export async function getIndexerUserByFid(fid: number): Promise<IndexerUser | null> {
  const indexerUser = await prismaIndexer.indexerUser.findUnique({ where: { fid } })

  if (!indexerUser) return null

  // Enrich with Farcaster
  const farcasterData = await getUsersMetadata([fid])
  const farcaster = farcasterData.get(fid)

  const pointsS1 = await getS1UserPointsByFid(fid)
  const pointsS2 = normalizeIndexerPoints(indexerUser.points)

  return {
    fid: indexerUser.fid,
    username: farcaster?.username ?? `fid:${fid}`,
    photoUrl: farcaster?.pfpUrl ?? null,
    points: pointsS1 + pointsS2,
    pointsS1,
    pointsS2,
    powerLevel: indexerUser.brnd_power_level,
    totalVotes: indexerUser.total_votes,
    lastVoteDay: indexerUser.last_vote_day,
  }
}
