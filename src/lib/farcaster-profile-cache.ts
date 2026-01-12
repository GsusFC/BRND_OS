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
  warpcastUrl: z.string().url().or(z.literal("")),
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
  warpcastUrl: z.string().url().or(z.literal("")),
  url: z.string().url().or(z.literal("")),
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

const toUrl = (value: string): URL | null => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const normalizeChannelId = (input: string): string => {
  assert(typeof input === "string", "normalizeChannelId: input must be a string")
  const trimmed = input.trim()
  assert(trimmed.length > 0, "normalizeChannelId: input must not be empty")

  let candidate = trimmed

  const urlCandidate = candidate.startsWith("http")
    ? candidate
    : candidate.startsWith("warpcast.com/") ||
        candidate.startsWith("www.warpcast.com/") ||
        candidate.startsWith("farcaster.xyz/") ||
        candidate.startsWith("www.farcaster.xyz/") ||
        candidate.startsWith("farcaster.com/") ||
        candidate.startsWith("www.farcaster.com/")
      ? `https://${candidate.replace(/^www\./, "")}`
      : ""

  const parsed = urlCandidate ? toUrl(urlCandidate) : null
  if (parsed) {
    const segments = parsed.pathname.split("/").filter(Boolean)
    let extracted = ""
    const channelIndex = segments.indexOf("channel")
    if (channelIndex >= 0) {
      extracted = segments[channelIndex + 1] ?? ""
    }
    if (!extracted) {
      const tildeIndex = segments.indexOf("~")
      if (tildeIndex >= 0 && segments[tildeIndex + 1] === "channel") {
        extracted = segments[tildeIndex + 2] ?? ""
      }
    }
    if (!extracted && segments.length > 0) {
      extracted = segments[0] ?? ""
    }
    candidate = extracted || candidate
  }

  candidate = candidate.replace(/^[@/]+/, "")
  candidate = candidate.replace(/^\/+/, "")
  candidate = (candidate.split("?")[0] ?? "").split("#")[0]?.split("/")[0] ?? ""
  const normalized = candidate.trim().toLowerCase()

  assert(normalized.length > 0, "normalizeChannelId: normalized channelId must not be empty")
  return normalized
}

const USERNAME_REGEX = /^(?!-)[a-z0-9-]{1,16}(\.eth)?$/

const normalizeUsernameInput = (input: string): string => {
  assert(typeof input === "string", "normalizeUsernameInput: input must be a string")
  const trimmed = input.trim()
  assert(trimmed.length > 0, "normalizeUsernameInput: input must not be empty")

  let candidate = trimmed

  const urlCandidate = candidate.startsWith("http")
    ? candidate
    : candidate.startsWith("warpcast.com/") ||
        candidate.startsWith("www.warpcast.com/") ||
        candidate.startsWith("farcaster.xyz/") ||
        candidate.startsWith("www.farcaster.xyz/") ||
        candidate.startsWith("farcaster.com/") ||
        candidate.startsWith("www.farcaster.com/")
      ? `https://${candidate.replace(/^www\./, "")}`
      : ""

  const parsed = urlCandidate ? toUrl(urlCandidate) : null
  if (parsed) {
    const pathSegment = parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? ""
    if (!pathSegment || pathSegment === "~") {
      throw new Error("Invalid username format. Provide a Farcaster profile username.")
    }
    candidate = pathSegment
  }

  candidate = candidate.replace(/^@+/, "")
  candidate = candidate.replace(/^\/+/, "")
  candidate = (candidate.split("?")[0] ?? "").split("#")[0]?.split("/")[0] ?? ""
  const normalized = candidate.trim().toLowerCase()

  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error(
      "Invalid username format. Use 1-16 lowercase letters, numbers, or hyphens; optional .eth.",
    )
  }

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
    const normalizedUsername = normalizeUsernameInput(username)

    const now = options?.now ?? new Date()
    const nowMs = now.getTime()
    const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS
    // Short TTL for negative cache (1 hour)
    const negativeTtlMs = 1000 * 60 * 60

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_user_cache WHERE username = ? AND expiresAtMs > ? LIMIT 1",
      args: [normalizedUsername, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchUserByUsernameCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)

      // Negative Cache Hit
      if (cached.notFound) {
        return { error: "User not found (cached)" }
      }

      const parsed = FarcasterUserProfileSchema.safeParse(cached)

      if (parsed.success) {
        return { success: true, data: parsed.data }
      }
      // If validation fails, fallback to fetching fresh data
      console.warn("Cached profile validation failed:", parsed.error.issues)
    }

    const fetched = await fetchUserByUsername(normalizedUsername)
    if ("error" in fetched) {
      // Negative Caching for 404
      const errorMsg = fetched.error || ""
      if (errorMsg.includes("404") || errorMsg.toLowerCase().includes("not found")) {
        const expiresAtMs = nowMs + negativeTtlMs
        // Note: We need a unique constraint on username for this to be perfect, 
        // but since we query by username it's fine.
        // However, the schema uses FID as primary key.
        // We can't insert into farcaster_user_cache without FID easily if FID is PK.
        // Wait, the table schema has `fid` as P.K.
        // If we don't have FID (because user not found), we can't store it in a table keyed by FID?
        // Actually, `fetchUserByUsername` in neynar doesn't give us FID if not found.
        // So `farcaster_user_cache` might not be suitable for username negative cache IF it requires FID.
        // Let's check table schema from `DATABASE_SCHEMA.md` or inferred from code.
        // Step 125 in users.ts implies `fid` is numeric and likely PK.
        // Step 160 in users.ts: `ON CONFLICT(fid)`.
        // So we cannot store negative cache *by username* in `farcaster_user_cache` if we don't know the FID?
        // Actually, we can't. 
        // But wait, if we are looking up by username, we need to know the FID to update.
        // If the user doesn't exist, we don't have an FID.
        // So we can't negative cache by username in THIS table setup easily.
        // ABORTING NEGATIVE CACHE FOR USERNAME (unless we change schema or use a dummy FID which is dangerous).
        // BUT, we can negative cache "username -> not found" in a separate interaction or just skip it.
        // Given the constraints, I will skip negative caching for *username* lookup for now to avoid complexity,
        // unless I assume there's a way. 
        // Actually, looking at `users.ts`, negative cache works because we HAVE the FID we are looking for (from Indexer).
        // Here we start with username.
        return { error: fetched.error || "Failed to fetch user" }
      }
      return { error: fetched.error || "Failed to fetch user" }
    }

    // Validate fetch result strictly
    const profileParse = FarcasterUserProfileSchema.safeParse(fetched.data)
    if (!profileParse.success) {
      console.error("Neynar API response validation failed:", profileParse.error.issues)
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
    const negativeTtlMs = 1000 * 60 * 60

    const cachedResult = await turso.execute({
      sql: "SELECT data FROM farcaster_channel_cache WHERE channelId = ? AND expiresAtMs > ? LIMIT 1",
      args: [normalizedChannelId, nowMs],
    })

    if (cachedResult.rows.length > 0) {
      const row = cachedResult.rows[0]
      assert(row, "fetchChannelByIdCached: expected a cache row")
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)

      if (cached.notFound) {
        return { error: "Channel not found (cached)" }
      }

      const parsed = FarcasterChannelSchema.safeParse(cached)

      if (parsed.success) {
        return { success: true, data: parsed.data }
      }
      console.warn("Cached channel validation failed:", parsed.error.issues)
    }

    const fetched = await fetchChannelById(normalizedChannelId)
    if ("error" in fetched) {
      const errorMsg = fetched.error || ""
      if (errorMsg.includes("404") || errorMsg.toLowerCase().includes("not found")) {
        const expiresAtMs = nowMs + negativeTtlMs
        // Store negative cache. channelId IS the PK here.
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
            normalizedChannelId,
            "", // Empty name
            "", // Empty url
            "", // Empty image
            JSON.stringify({ notFound: true }),
            nowMs,
            expiresAtMs,
            nowMs,
            nowMs,
          ],
        })
      }
      return { error: fetched.error || "Failed to fetch channel" }
    }

    // Validate fetch result strictly
    const channelParse = FarcasterChannelSchema.safeParse(fetched.data)
    if (!channelParse.success) {
      console.error("Neynar API response validation failed:", channelParse.error.issues)
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
  const negativeTtlMs = 1000 * 60 * 60

  assert(
    typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0,
    "getProfilesByFids: ttlMs must be a positive number",
  )

  const uniqueFids = normalizeFids(inputFids)

  // Optimization: If no FIDs, return early
  if (uniqueFids.length === 0) return []

  const placeholders = uniqueFids.map(() => "?").join(",")
  // Note: If array is empty, this SQL would be invalid, but normalizeFids checks for length > 0
  const cachedResult = await turso.execute({
    sql: `SELECT fid, data FROM farcaster_user_cache WHERE fid IN (${placeholders}) AND expiresAtMs > ?`,
    args: [...uniqueFids, nowMs],
  })

  const profileByFid = new Map<number, FarcasterUserProfile>()
  const negativeCacheFids = new Set<number>()

  for (const row of cachedResult.rows) {
    const fidVal = row.fid
    const fid = typeof fidVal === 'number' ? fidVal : Number(fidVal)

    if (!Number.isInteger(fid) || fid <= 0) {
      continue // Skip invalid FIDs
    }

    try {
      const data = parseTextValue(row.data)
      const cached = JSON.parse(data)

      if (cached.notFound) {
        negativeCacheFids.add(fid)
        continue
      }

      const parsed = FarcasterUserProfileSchema.safeParse(cached)
      if (parsed.success) {
        profileByFid.set(fid, parsed.data)
      }
    } catch {
      // Skip corrupted cache entries
    }
  }

  // Filter out FIDs that are either found OR in negative cache
  const missingFids = uniqueFids.filter((fid) => !profileByFid.has(fid) && !negativeCacheFids.has(fid))

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

      // Found profiles: cache with normal TTL
      for (const profile of fetchedByFid.values()) {
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
        profileByFid.set(profile.fid, profile)
      }

      // Missing profiles: cache with negative TTL
      const fetchedFids = new Set(fetchedByFid.keys())
      const actuallyMissingCunkFids = fidsChunk.filter(fid => !fetchedFids.has(fid))

      if (actuallyMissingCunkFids.length > 0) {
        const expiresAtMs = nowMs + negativeTtlMs
        // Batch these if possible, but simplest is iteration
        for (const missingFid of actuallyMissingCunkFids) {
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
              missingFid,
              null,
              null,
              null,
              JSON.stringify({ notFound: true }),
              nowMs,
              expiresAtMs,
              nowMs,
              nowMs,
            ],
          }).catch(e => console.warn("Failed to write negative cache", e))
        }
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
