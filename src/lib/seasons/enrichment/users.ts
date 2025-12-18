/**
 * Enriquecimiento de usuarios del Indexer
 * Obtiene metadata (username, pfp) desde Turso cache (Farcaster/Neynar)
 */

import { cache } from "react"
import turso from "@/lib/turso"
import { fetchUsersBulk } from "@/lib/neynar"

export interface UserMetadata {
  fid: number
  username: string | null
  displayName: string | null
  pfpUrl: string | null
}

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

let isSchemaReady = false

async function ensureSchema(): Promise<void> {
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
  
  isSchemaReady = true
}

/**
 * Obtiene metadata de un usuario por FID desde cache
 */
export async function getUserMetadata(fid: number): Promise<UserMetadata | null> {
  const result = await getUsersMetadata([fid])
  return result.get(fid) ?? null
}

/**
 * Obtiene metadata de múltiples usuarios por FIDs
 * Graceful degradation: devuelve lo que pueda, sin fallar
 */
async function getUsersMetadataImpl(
  fids: number[],
  options?: { fetchMissingFromNeynar?: boolean }
): Promise<Map<number, UserMetadata>> {
  if (fids.length === 0) return new Map()

  const result = new Map<number, UserMetadata>()
  const uniqueFids = [...new Set(fids.filter(f => f > 0))]
  
  if (uniqueFids.length === 0) return result

  const fetchMissingFromNeynar = options?.fetchMissingFromNeynar ?? true

  try {
    await ensureSchema()
    const nowMs = Date.now()

    // Check cache first
    const placeholders = uniqueFids.map(() => "?").join(",")
    const cached = await turso.execute({
      sql: `SELECT fid, username, displayName, pfpUrl FROM farcaster_user_cache WHERE fid IN (${placeholders}) AND expiresAtMs > ?`,
      args: [...uniqueFids, nowMs],
    })

    for (const row of cached.rows) {
      const fid = Number(row.fid)
      result.set(fid, {
        fid,
        username: row.username as string | null,
        displayName: row.displayName as string | null,
        pfpUrl: row.pfpUrl as string | null,
      })
    }

    if (fetchMissingFromNeynar) {
      // Fetch missing from Neynar
      const missingFids = uniqueFids.filter(fid => !result.has(fid))
      
      if (missingFids.length > 0) {
        const neynarResult = await fetchUsersBulk(missingFids)
        
        if (!("error" in neynarResult) && Array.isArray(neynarResult.data)) {
          const expiresAtMs = nowMs + DEFAULT_CACHE_TTL_MS

          for (const profile of neynarResult.data) {
            result.set(profile.fid, {
              fid: profile.fid,
              username: profile.username,
              displayName: profile.name,
              pfpUrl: profile.imageUrl,
            })
          }

          const chunkSize = 100
          for (let i = 0; i < neynarResult.data.length; i += chunkSize) {
            const chunk = neynarResult.data.slice(i, i + chunkSize)
            const valuesSql = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",")
            const args = chunk.flatMap((profile) => [
              profile.fid,
              profile.username,
              profile.name,
              profile.imageUrl,
              JSON.stringify(profile),
              nowMs,
              expiresAtMs,
              nowMs,
              nowMs,
            ])

            try {
              await turso.execute({
                sql: `INSERT INTO farcaster_user_cache (fid, username, displayName, pfpUrl, data, fetchedAtMs, expiresAtMs, createdAtMs, updatedAtMs)
                      VALUES ${valuesSql}
                      ON CONFLICT(fid) DO UPDATE SET username=excluded.username, displayName=excluded.displayName, pfpUrl=excluded.pfpUrl, data=excluded.data, fetchedAtMs=excluded.fetchedAtMs, expiresAtMs=excluded.expiresAtMs, updatedAtMs=excluded.updatedAtMs`,
                args,
              })
            } catch (error) {
              console.warn("[getUsersMetadata] Cache write error:", error instanceof Error ? error.message : error)
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("[getUsersMetadata] Error:", error instanceof Error ? error.message : error)
  }

  return result
}

const getUsersMetadataCached = cache(async (
  key: string,
  fetchMissingFromNeynar: boolean
): Promise<Map<number, UserMetadata>> => {
  const fids = key.split(",").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
  return getUsersMetadataImpl(fids, { fetchMissingFromNeynar })
})

/**
 * Obtiene metadata de múltiples usuarios por FIDs
 * Graceful degradation: devuelve lo que pueda, sin fallar
 */
export async function getUsersMetadata(
  fids: number[],
  options?: { fetchMissingFromNeynar?: boolean }
): Promise<Map<number, UserMetadata>> {
  if (fids.length === 0) return new Map()

  const fetchMissingFromNeynar = options?.fetchMissingFromNeynar ?? true
  const key = [...new Set(fids.filter((f) => Number.isInteger(f) && f > 0))].sort((a, b) => a - b).join(",")
  if (key.length === 0) return new Map()

  return getUsersMetadataCached(key, fetchMissingFromNeynar)
}

/**
 * Enriquece un array de objetos que tienen fid con metadata de usuario
 */
export async function enrichWithUserMetadata<T extends { fid: number }>(
  items: T[]
): Promise<(T & { username: string | null; userPhoto: string | null })[]> {
  const fids = items.map((item) => item.fid)
  const metadata = await getUsersMetadata(fids)

  return items.map((item) => {
    const user = metadata.get(item.fid)
    return {
      ...item,
      username: user?.username ?? user?.displayName ?? null,
      userPhoto: user?.pfpUrl ?? null,
    }
  })
}
