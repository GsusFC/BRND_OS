"use server"

import turso from "@/lib/turso"
import { fetchChannelById, fetchUserByUsername, fetchUsersBulk } from "@/lib/neynar"

export type FarcasterUserProfile = {
  fid: number
  name: string
  username: string
  description: string
  imageUrl: string
  followerCount: number
  followingCount: number
  warpcastUrl: string
  powerBadge: boolean
  neynarScore: number | null
  verifications: string[]
}

export type FarcasterChannel = {
  id: string
  name: string
  description: string
  imageUrl: string
  followerCount: number
  warpcastUrl: string
  url: string
  lead:
    | {
        fid: number
        username: string
        displayName: string
        pfpUrl: string
      }
    | null
}

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6

let isSchemaReady = false

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) {
    throw new Error(message)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const parseFidValue = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") return Number(value)
  throw new Error(`getProfilesByFids: invalid fid type in cache row: ${typeof value}`)
}

const parseTextValue = (value: unknown): string => {
  if (typeof value === "string") return value
  throw new Error(`getProfilesByFids: invalid text type in cache row: ${typeof value}`)
}

const isFarcasterUserProfile = (value: unknown): value is FarcasterUserProfile => {
  if (!isRecord(value)) return false

  return (
    typeof value.fid === "number" &&
    Number.isInteger(value.fid) &&
    typeof value.name === "string" &&
    typeof value.username === "string" &&
    typeof value.description === "string" &&
    typeof value.imageUrl === "string" &&
    typeof value.followerCount === "number" &&
    typeof value.followingCount === "number" &&
    typeof value.warpcastUrl === "string" &&
    typeof value.powerBadge === "boolean" &&
    (typeof value.neynarScore === "number" || value.neynarScore === null) &&
    Array.isArray(value.verifications) &&
    value.verifications.every((v) => typeof v === "string")
  )
}

const isFarcasterChannel = (value: unknown): value is FarcasterChannel => {
  if (!isRecord(value)) return false

  const lead = value.lead
  const leadOk =
    lead === null ||
    (isRecord(lead) &&
      typeof lead.fid === "number" &&
      Number.isInteger(lead.fid) &&
      typeof lead.username === "string" &&
      typeof lead.displayName === "string" &&
      typeof lead.pfpUrl === "string")

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.imageUrl === "string" &&
    typeof value.followerCount === "number" &&
    typeof value.warpcastUrl === "string" &&
    typeof value.url === "string" &&
    leadOk
  )
}

const normalizeFids = (inputFids: number[]): number[] => {
  assert(Array.isArray(inputFids), "getProfilesByFids: fids must be an array")
  assert(inputFids.length > 0, "getProfilesByFids: fids must not be empty")

  const unique = new Set<number>()

  for (const fid of inputFids) {
    assert(
      typeof fid === "number" && Number.isInteger(fid) && fid > 0,
      `getProfilesByFids: invalid fid: ${String(fid)}`,
    )
    unique.add(fid)
  }

  return Array.from(unique)
}

const normalizeChannelId = (input: string): string => {
  assert(typeof input === "string", "normalizeChannelId: input must be a string")
  const trimmed = input.trim()
  assert(trimmed.length > 0, "normalizeChannelId: input must not be empty")

  const withoutPrefix = trimmed.replace(/^[@/]+/, "")
  const withoutQuery = withoutPrefix.split("?")[0] ?? ""
  const withoutHash = withoutQuery.split("#")[0] ?? ""
  const withoutPath = withoutHash.split("/")[0] ?? ""
  const normalized = withoutPath.trim()

  assert(normalized.length > 0, "normalizeChannelId: normalized channelId must not be empty")
  return normalized
}

const chunk = <T>(items: T[], size: number): T[][] => {
  assert(Number.isInteger(size) && size > 0, "chunk: invalid size")

  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

const ensureTursoSchema = async (): Promise<void> => {
  if (isSchemaReady) return

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS farcaster_user_cache (
      fid INTEGER PRIMARY KEY,
      username TEXT,
      displayName TEXT,
      pfpUrl TEXT,
      data TEXT NOT NULL,
      fetchedAtMs INTEGER NOT NULL,
      expiresAtMs INTEGER NOT NULL,
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL
    )
  `)

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_farcaster_user_cache_username ON farcaster_user_cache (username)"
  )
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_farcaster_user_cache_expiresAtMs ON farcaster_user_cache (expiresAtMs)"
  )

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS farcaster_channel_cache (
      channelId TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      imageUrl TEXT,
      data TEXT NOT NULL,
      fetchedAtMs INTEGER NOT NULL,
      expiresAtMs INTEGER NOT NULL,
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL
    )
  `)

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_farcaster_channel_cache_expiresAtMs ON farcaster_channel_cache (expiresAtMs)"
  )

  isSchemaReady = true
}

export const fetchUserByUsernameCached = async (
  username: string,
  options?: { ttlMs?: number; now?: Date },
): Promise<{ success: true; data: FarcasterUserProfile } | { error: string }> => {
  try {
    assert(typeof username === "string" && username.trim().length > 0, "fetchUserByUsernameCached: username required")

    const now = options?.now ?? new Date()
    const nowMs = now.getTime()
    const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS

    await ensureTursoSchema()

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_user_cache WHERE username = ? AND expiresAtMs > ? LIMIT 1",
      args: [username, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchUserByUsernameCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached: unknown = JSON.parse(data)
      assert(isFarcasterUserProfile(cached), "fetchUserByUsernameCached: invalid cached profile shape")
      return { success: true, data: cached }
    }

    const fetched = await fetchUserByUsername(username)
    if ("error" in fetched) {
      assert(typeof fetched.error === "string", "fetchUserByUsernameCached: invalid neynar error")
      return { error: fetched.error }
    }

    const profile: FarcasterUserProfile = fetched.data
    assert(isFarcasterUserProfile(profile), "fetchUserByUsernameCached: invalid neynar profile shape")

    const expiresAtMs = nowMs + ttlMs

    await turso.execute({
      sql: `
        INSERT INTO farcaster_user_cache (
          fid,
          username,
          displayName,
          pfpUrl,
          data,
          fetchedAtMs,
          expiresAtMs,
          createdAtMs,
          updatedAtMs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fid) DO UPDATE SET
          username = excluded.username,
          displayName = excluded.displayName,
          pfpUrl = excluded.pfpUrl,
          data = excluded.data,
          fetchedAtMs = excluded.fetchedAtMs,
          expiresAtMs = excluded.expiresAtMs,
          updatedAtMs = excluded.updatedAtMs
      `,
      args: [
        profile.fid,
        profile.username,
        profile.name,
        profile.imageUrl,
        JSON.stringify(profile),
        nowMs,
        expiresAtMs,
        nowMs,
        nowMs,
      ],
    })

    return { success: true, data: profile }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "fetchUserByUsernameCached: unknown error" }
  }
}

export const fetchChannelByIdCached = async (
  channelId: string,
  options?: { ttlMs?: number; now?: Date },
): Promise<{ success: true; data: FarcasterChannel } | { error: string }> => {
  try {
    assert(typeof channelId === "string" && channelId.trim().length > 0, "fetchChannelByIdCached: channelId required")

    const normalizedChannelId = normalizeChannelId(channelId)

    const now = options?.now ?? new Date()
    const nowMs = now.getTime()
    const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS

    await ensureTursoSchema()

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_channel_cache WHERE channelId = ? AND expiresAtMs > ? LIMIT 1",
      args: [normalizedChannelId, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchChannelByIdCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached: unknown = JSON.parse(data)
      assert(isFarcasterChannel(cached), "fetchChannelByIdCached: invalid cached channel shape")
      return { success: true, data: cached }
    }

    const fetched = await fetchChannelById(normalizedChannelId)
    if ("error" in fetched) {
      assert(typeof fetched.error === "string", "fetchChannelByIdCached: invalid neynar error")
      return { error: fetched.error }
    }

    const channel: FarcasterChannel = fetched.data
    assert(isFarcasterChannel(channel), "fetchChannelByIdCached: invalid neynar channel shape")

    const expiresAtMs = nowMs + ttlMs

    await turso.execute({
      sql: `
        INSERT INTO farcaster_channel_cache (
          channelId,
          name,
          url,
          imageUrl,
          data,
          fetchedAtMs,
          expiresAtMs,
          createdAtMs,
          updatedAtMs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(channelId) DO UPDATE SET
          name = excluded.name,
          url = excluded.url,
          imageUrl = excluded.imageUrl,
          data = excluded.data,
          fetchedAtMs = excluded.fetchedAtMs,
          expiresAtMs = excluded.expiresAtMs,
          updatedAtMs = excluded.updatedAtMs
      `,
      args: [
        channel.id,
        channel.name,
        channel.url,
        channel.imageUrl,
        JSON.stringify(channel),
        nowMs,
        expiresAtMs,
        nowMs,
        nowMs,
      ],
    })

    return { success: true, data: channel }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "fetchChannelByIdCached: unknown error" }
  }
}

export const getProfilesByFids = async (
  inputFids: number[],
  options?: { ttlMs?: number; now?: Date },
): Promise<FarcasterUserProfile[]> => {
  const now = options?.now ?? new Date()
  const nowMs = now.getTime()
  const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS

  assert(
    typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0,
    "getProfilesByFids: ttlMs must be a positive number",
  )

  const uniqueFids = normalizeFids(inputFids)

  await ensureTursoSchema()

  const placeholders = uniqueFids.map(() => "?").join(",")
  const cachedResult = await turso.execute({
    sql: `SELECT fid, data FROM farcaster_user_cache WHERE fid IN (${placeholders}) AND expiresAtMs > ?`,
    args: [...uniqueFids, nowMs],
  })

  const profileByFid = new Map<number, FarcasterUserProfile>()

  for (const row of cachedResult.rows) {
    const fid = parseFidValue(row.fid)
    assert(Number.isInteger(fid) && fid > 0, "getProfilesByFids: invalid fid in cache row")

    const data = parseTextValue(row.data)

    const cached: unknown = JSON.parse(data)
    assert(
      isFarcasterUserProfile(cached),
      `getProfilesByFids: invalid cached profile shape for fid ${String(fid)}`,
    )
    profileByFid.set(fid, cached)
  }

  const missingFids = uniqueFids.filter((fid) => !profileByFid.has(fid))

  if (missingFids.length > 0) {
    const chunks = chunk(missingFids, 100)

    for (const fidsChunk of chunks) {
      const result = await fetchUsersBulk(fidsChunk)
      if ("error" in result) {
        throw new Error(`getProfilesByFids: neynar error: ${result.error}`)
      }
      assert(Array.isArray(result.data), "getProfilesByFids: neynar bulk result must be an array")

      const fetchedByFid = new Map<number, FarcasterUserProfile>()

      for (const profile of result.data) {
        assert(isFarcasterUserProfile(profile), "getProfilesByFids: invalid neynar profile shape")
        fetchedByFid.set(profile.fid, profile)
      }

      const unresolved = fidsChunk.filter((fid) => !fetchedByFid.has(fid))
      assert(
        unresolved.length === 0,
        `getProfilesByFids: missing profiles for fids: ${unresolved.join(",")}`,
      )

      const expiresAtMs = nowMs + ttlMs
      const createdAtMs = nowMs
      const updatedAtMs = nowMs

      for (const profile of fetchedByFid.values()) {
        await turso.execute({
          sql: `
            INSERT INTO farcaster_user_cache (
              fid,
              username,
              displayName,
              pfpUrl,
              data,
              fetchedAtMs,
              expiresAtMs,
              createdAtMs,
              updatedAtMs
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fid) DO UPDATE SET
              username = excluded.username,
              displayName = excluded.displayName,
              pfpUrl = excluded.pfpUrl,
              data = excluded.data,
              fetchedAtMs = excluded.fetchedAtMs,
              expiresAtMs = excluded.expiresAtMs,
              updatedAtMs = excluded.updatedAtMs
          `,
          args: [
            profile.fid,
            profile.username,
            profile.name,
            profile.imageUrl,
            JSON.stringify(profile),
            nowMs,
            expiresAtMs,
            createdAtMs,
            updatedAtMs,
          ],
        })
      }

      for (const profile of fetchedByFid.values()) {
        profileByFid.set(profile.fid, profile)
      }
    }
  }

  const out: FarcasterUserProfile[] = []
  for (const fid of inputFids) {
    const profile = profileByFid.get(fid)
    assert(profile, `getProfilesByFids: missing profile after resolution for fid ${fid}`)
    out.push(profile)
  }

  return out
}
