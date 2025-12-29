import prismaIndexer from "@/lib/prisma-indexer"
import turso from "@/lib/turso"
import { incrementCounter, recordLatency } from "@/lib/metrics"
import { getUsersMetadata } from "../enrichment/users"
import { Decimal } from "@prisma/client/runtime/library"
import assert from "node:assert"

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS

const MATERIALIZED_TTL_MS = 60_000
const USERS_ALLTIME_CACHE_KEY = "leaderboard:users:alltime:v1"

let isUsersLeaderboardSchemaReady = false
let refreshUsersLeaderboardPromise: Promise<void> | null = null

async function ensureUsersLeaderboardSchema(): Promise<void> {
  if (isUsersLeaderboardSchemaReady) return

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard_materialization_meta (
      key TEXT PRIMARY KEY,
      expiresAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL
    )
  `)

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard_users_alltime (
      fid INTEGER PRIMARY KEY,
      points REAL NOT NULL,
      pointsS1 REAL NOT NULL,
      pointsS2 REAL NOT NULL,
      updatedAtMs INTEGER NOT NULL
    )
  `)

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_leaderboard_users_alltime_points ON leaderboard_users_alltime (points)"
  )

  isUsersLeaderboardSchemaReady = true
}

async function refreshUsersLeaderboardMaterialized(nowMs: number): Promise<void> {
  const startMs = Date.now()
  let ok = false

  const leaderboardRows = await prismaIndexer.indexerAllTimeUserLeaderboard.findMany({
    select: { fid: true, points: true },
  })

  try {
    await turso.execute("DELETE FROM leaderboard_users_alltime")

    const chunkSize = 200
    const updatedAtMs = nowMs

    for (let i = 0; i < leaderboardRows.length; i += chunkSize) {
      const chunk = leaderboardRows.slice(i, i + chunkSize)

      const valuesSql = chunk.map(() => "(?, ?, ?, ?, ?)").join(",")
      const args = chunk.flatMap((row) => {
        const pointsS2 = normalizeIndexerPoints(row.points)
        const pointsS1 = 0
        const points = pointsS2

        return [row.fid, points, pointsS1, pointsS2, updatedAtMs]
      })

      await turso.execute({
        sql: `INSERT INTO leaderboard_users_alltime (fid, points, pointsS1, pointsS2, updatedAtMs)
              VALUES ${valuesSql}
              ON CONFLICT(fid) DO UPDATE SET points=excluded.points, pointsS1=excluded.pointsS1, pointsS2=excluded.pointsS2, updatedAtMs=excluded.updatedAtMs`,
        args,
      })
    }

    const expiresAtMs = nowMs + MATERIALIZED_TTL_MS
    await turso.execute({
      sql: `INSERT INTO leaderboard_materialization_meta (key, expiresAtMs, updatedAtMs)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET expiresAtMs=excluded.expiresAtMs, updatedAtMs=excluded.updatedAtMs`,
      args: [USERS_ALLTIME_CACHE_KEY, expiresAtMs, nowMs],
    })

    ok = true
  } finally {
    await recordLatency("cache.refresh.leaderboard_users_alltime", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("cache.refresh_error.leaderboard_users_alltime")
  }
}

async function ensureUsersLeaderboardMaterialized(): Promise<void> {
  await ensureUsersLeaderboardSchema()

  const nowMs = Date.now()
  const meta = await turso.execute({
    sql: "SELECT expiresAtMs FROM leaderboard_materialization_meta WHERE key = ? LIMIT 1",
    args: [USERS_ALLTIME_CACHE_KEY],
  })

  const expiresAtMsRaw = meta.rows[0]?.expiresAtMs
  const expiresAtMs = expiresAtMsRaw === undefined ? 0 : Number(expiresAtMsRaw)

  if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
    await incrementCounter("cache.hit.leaderboard_users_alltime")
    return
  }

  await incrementCounter("cache.miss.leaderboard_users_alltime")

  if (refreshUsersLeaderboardPromise) {
    await incrementCounter("cache.wait.leaderboard_users_alltime")
    await refreshUsersLeaderboardPromise
    return
  }

  refreshUsersLeaderboardPromise = (async () => {
    try {
      await refreshUsersLeaderboardMaterialized(nowMs)
    } finally {
      refreshUsersLeaderboardPromise = null
    }
  })()

  await refreshUsersLeaderboardPromise
}

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
  const startMs = Date.now()
  let ok = false

  try {
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
      await ensureUsersLeaderboardMaterialized()

      const sqlOrder = sortOrder === "asc" ? "ASC" : "DESC"
      const [countResult, pageResult] = await Promise.all([
        turso.execute("SELECT COUNT(*) as totalCount FROM leaderboard_users_alltime"),
        turso.execute({
          sql: `SELECT fid, points, pointsS1, pointsS2
                FROM leaderboard_users_alltime
                ORDER BY points ${sqlOrder}
                LIMIT ? OFFSET ?`,
          args: [pageSize, offset],
        }),
      ])

      const totalCountRaw = countResult.rows[0]?.totalCount
      const totalCount = totalCountRaw === undefined ? 0 : Number(totalCountRaw)
      assert(Number.isFinite(totalCount) && totalCount >= 0, "Invalid totalCount from leaderboard_users_alltime")

      const pageSlice = pageResult.rows.map((row) => {
        const fid = Number(row.fid)
        const points = Number(row.points)
        const pointsS1 = Number(row.pointsS1)
        const pointsS2 = Number(row.pointsS2)

        assert(Number.isInteger(fid) && fid > 0, "Invalid fid from leaderboard_users_alltime")
        assert(Number.isFinite(points), "Invalid points from leaderboard_users_alltime")
        assert(Number.isFinite(pointsS1), "Invalid pointsS1 from leaderboard_users_alltime")
        assert(Number.isFinite(pointsS2), "Invalid pointsS2 from leaderboard_users_alltime")

        return { fid, points, pointsS1, pointsS2 }
      })

      const fids = pageSlice.map((r) => r.fid)

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

      ok = true
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
    const farcasterData = await getUsersMetadata(fids)

    // Map to our interface
    const users: IndexerUser[] = indexerUsers.map(u => {
      const farcaster = farcasterData.get(u.fid)
      const pointsS2 = normalizeIndexerPoints(u.points)
      return {
        fid: u.fid,
        username: farcaster?.username ?? `fid:${u.fid}`,
        photoUrl: farcaster?.pfpUrl ?? null,
        points: pointsS2,
        pointsS1: 0,
        pointsS2,
        powerLevel: u.brnd_power_level,
        totalVotes: u.total_votes,
        lastVoteDay: u.last_vote_day,
      }
    })

    ok = true
    return {
      users,
      totalCount,
      page,
      pageSize,
    }
  } finally {
    await recordLatency("indexer.users.list", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("indexer.users.list.error")
  }
}

/**
 * Get a single user by FID from Indexer + S1 points from MySQL
 */
export async function getIndexerUserByFid(fid: number): Promise<IndexerUser | null> {
  const startMs = Date.now()
  let ok = false

  try {
    const indexerUser = await prismaIndexer.indexerUser.findUnique({ where: { fid } })

    if (!indexerUser) {
      ok = true
      return null
    }

    // Enrich with Farcaster
    const farcasterData = await getUsersMetadata([fid])
    const farcaster = farcasterData.get(fid)

    const pointsS2 = normalizeIndexerPoints(indexerUser.points)

    ok = true
    return {
      fid: indexerUser.fid,
      username: farcaster?.username ?? `fid:${fid}`,
      photoUrl: farcaster?.pfpUrl ?? null,
      points: pointsS2,
      pointsS1: 0,
      pointsS2,
      powerLevel: indexerUser.brnd_power_level,
      totalVotes: indexerUser.total_votes,
      lastVoteDay: indexerUser.last_vote_day,
    }
  } finally {
    await recordLatency("indexer.users.by_fid", Date.now() - startMs, ok)
    if (!ok) await incrementCounter("indexer.users.by_fid.error")
  }
}
