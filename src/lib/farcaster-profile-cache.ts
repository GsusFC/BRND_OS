"use server"

import turso from "@/lib/turso"
import { fetchChannelById, fetchUserByUsername, fetchUsersBulk } from "@/lib/neynar"
import { z } from "zod"

// Zod Schemas for Strict Data Integrity
const FarcasterUserProfileSchema = z.object({
  fid: z.number().int().positive(),
  name: z.string(),
  username: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  warpcastUrl: z.string().url(),
  powerBadge: z.boolean().optional().default(false),
  neynarScore: z.number().nullable(),
  verifications: z.array(z.string()),
})

export type FarcasterUserProfile = z.infer<typeof FarcasterUserProfileSchema>

const FarcasterChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  followerCount: z.number().int().nonnegative(),
  warpcastUrl: z.string().url(),
  url: z.string().url(),
  lead: z
    .object({
      fid: z.number().int(),
      username: z.string(),
      displayName: z.string(),
      pfpUrl: z.string(),
    })
    .nullable(),
})

export type FarcasterChannel = z.infer<typeof FarcasterChannelSchema>

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) {
    throw new Error(message)
  }
}

const parseTextValue = (value: unknown): string => {
  if (typeof value === "string") return value
  throw new Error(`Invalid text type in cache row: ${typeof value}`)
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

export const fetchUserByUsernameCached = async (
  username: string,
  options?: { ttlMs?: number; now?: Date },
): Promise<{ success: true; data: FarcasterUserProfile } | { error: string }> => {
  try {
    assert(typeof username === "string" && username.trim().length > 0, "fetchUserByUsernameCached: username required")

    const now = options?.now ?? new Date()
    const nowMs = now.getTime()
    const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_user_cache WHERE username = ? AND expiresAtMs > ? LIMIT 1",
      args: [username, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchUserByUsernameCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)
      const parsed = FarcasterUserProfileSchema.safeParse(cached)
      
      if (parsed.success) {
        return { success: true, data: parsed.data }
      }
      // If validation fails, fallback to fetching fresh data
      console.warn("Cached profile validation failed:", parsed.error)
    }

    const fetched = await fetchUserByUsername(username)
    if ("error" in fetched) {
      return { error: fetched.error || "Failed to fetch user" }
    }

    // Validate fetch result strictly
    const profileParse = FarcasterUserProfileSchema.safeParse(fetched.data)
    if (!profileParse.success) {
      console.error("Neynar API response validation failed:", profileParse.error)
      return { error: "Received invalid data from provider" }
    }
    const profile = profileParse.data

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

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_channel_cache WHERE channelId = ? AND expiresAtMs > ? LIMIT 1",
      args: [normalizedChannelId, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchChannelByIdCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)
      const parsed = FarcasterChannelSchema.safeParse(cached)

      if (parsed.success) {
        return { success: true, data: parsed.data }
      }
      console.warn("Cached channel validation failed:", parsed.error)
    }

    const fetched = await fetchChannelById(normalizedChannelId)
    if ("error" in fetched) {
      return { error: fetched.error || "Failed to fetch channel" }
    }

    // Validate fetch result strictly
    const channelParse = FarcasterChannelSchema.safeParse(fetched.data)
    if (!channelParse.success) {
       console.error("Neynar API response validation failed:", channelParse.error)
       return { error: "Received invalid data from provider" }
    }
    const channel = channelParse.data

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

  const placeholders = uniqueFids.map(() => "?").join(",")
  // Note: If array is empty, this SQL would be invalid, but normalizeFids checks for length > 0
  const cachedResult = await turso.execute({
    sql: `SELECT fid, data FROM farcaster_user_cache WHERE fid IN (${placeholders}) AND expiresAtMs > ?`,
    args: [...uniqueFids, nowMs],
  })

  const profileByFid = new Map<number, FarcasterUserProfile>()

  for (const row of cachedResult.rows) {
    const fidVal = row.fid
    const fid = typeof fidVal === 'number' ? fidVal : Number(fidVal)
    
    if (!Number.isInteger(fid) || fid <= 0) {
        continue // Skip invalid FIDs
    }

    try {
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)
      const parsed = FarcasterUserProfileSchema.safeParse(cached)
      if (parsed.success) {
        profileByFid.set(fid, parsed.data)
      }
    } catch {
      // Skip corrupted cache entries
    }
  }

  const missingFids = uniqueFids.filter((fid) => !profileByFid.has(fid))

  if (missingFids.length > 0) {
    const chunks = chunk(missingFids, 100)

    for (const fidsChunk of chunks) {
      const result = await fetchUsersBulk(fidsChunk)
      if ("error" in result) {
        throw new Error(`getProfilesByFids: neynar error: ${result.error}`)
      }
      
      const fetchedByFid = new Map<number, FarcasterUserProfile>()

      for (const profileRaw of result.data) {
        const parsed = FarcasterUserProfileSchema.safeParse(profileRaw)
        if (parsed.success) {
            fetchedByFid.set(parsed.data.fid, parsed.data)
        } else {
             console.error(`Skipping invalid profile from bulk fetch (FID ${profileRaw.fid}):`, parsed.error)
        }
      }

      // Check for strictly missing FIDs (Neynar might not return them if not found)
      // We don't throw here to be resilient, just treat them as not found
      
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
    if (profile) {
        out.push(profile)
    }
  }

  return out
}
