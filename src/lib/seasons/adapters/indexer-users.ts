import prismaIndexer from "@/lib/prisma-indexer"
import { getUsersMetadata } from "../enrichment/users"

export interface IndexerUser {
  fid: number
  username: string
  photoUrl: string | null
  points: number
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
  
  // Enrich with Farcaster metadata
  const farcasterData = await getUsersMetadata(fids)

  // Map to our interface
  const users: IndexerUser[] = indexerUsers.map(u => {
    const farcaster = farcasterData.get(u.fid)
    return {
      fid: u.fid,
      username: farcaster?.username ?? `fid:${u.fid}`,
      photoUrl: farcaster?.pfpUrl ?? null,
      points: Number(u.points),
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
 * Get a single user by FID from Indexer
 */
export async function getIndexerUserByFid(fid: number): Promise<IndexerUser | null> {
  const indexerUser = await prismaIndexer.indexerUser.findUnique({
    where: { fid },
  })

  if (!indexerUser) return null

  // Enrich with Farcaster
  const farcasterData = await getUsersMetadata([fid])
  const farcaster = farcasterData.get(fid)

  return {
    fid: indexerUser.fid,
    username: farcaster?.username ?? `fid:${fid}`,
    photoUrl: farcaster?.pfpUrl ?? null,
    points: Number(indexerUser.points),
    powerLevel: indexerUser.brnd_power_level,
    totalVotes: indexerUser.total_votes,
    lastVoteDay: indexerUser.last_vote_day,
  }
}
