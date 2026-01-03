/**
 * Enriquecimiento de usuarios del Indexer
 * Cache de 3 niveles: Redis → Turso → Neynar API
 * Redis (1era capa): Cache distribuido rápido (6h TTL)
 * Turso (2da capa): Cache persistente (6h TTL)
 * Neynar (3era capa): Source of truth (si fetchMissingFromNeynar=true)
 */

import { cache } from "react"
import turso from "@/lib/turso"
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis"
import { fetchUsersBulk } from "@/lib/neynar"

export interface UserMetadata {
  fid: number
  username: string | null
  displayName: string | null
  pfpUrl: string | null
}

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

/**
 * Obtiene metadata de un usuario por FID desde cache
 */
export async function getUserMetadata(fid: number): Promise<UserMetadata | null> {
  const result = await getUsersMetadata([fid])
  return result.get(fid) ?? null
}

/**
 * Obtiene metadata de múltiples usuarios por FIDs
 * Cache de 3 niveles: Redis → Turso → Neynar
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
  const nowMs = Date.now()

  // NIVEL 1: Intentar desde Redis (más rápido)
  const redisKeys = uniqueFids.map(fid => CACHE_KEYS.user(fid))
  let missingAfterRedis: number[] = []

  try {
    const cachedValues = await redis.mget<UserMetadata[]>(...redisKeys)

    for (let i = 0; i < uniqueFids.length; i++) {
      const cached = cachedValues[i]
      if (cached && typeof cached === 'object' && 'fid' in cached) {
        result.set(uniqueFids[i], cached)
      } else {
        missingAfterRedis.push(uniqueFids[i])
      }
    }

    if (process.env.REDIS_DEBUG === 'true') {
      console.log(`[users.ts] Redis: ${result.size} hits, ${missingAfterRedis.length} misses`)
    }
  } catch (error) {
    console.warn("[users.ts] Redis unavailable:", error instanceof Error ? error.message : error)
    // Si Redis falla, intentar Turso con todos los FIDs
    missingAfterRedis = uniqueFids
  }

  // NIVEL 2: Intentar desde Turso (cache persistente)
  if (missingAfterRedis.length > 0) {
    try {
      const placeholders = missingAfterRedis.map(() => "?").join(",")
      const cached = await turso.execute({
        sql: `SELECT fid, username, displayName, pfpUrl FROM farcaster_user_cache WHERE fid IN (${placeholders}) AND expiresAtMs > ?`,
        args: [...missingAfterRedis, nowMs],
      })

      const redisPipeline = redis.pipeline()
      const foundInTurso = new Set<number>()

      for (const row of cached.rows) {
        const fid = Number(row.fid)
        const metadata: UserMetadata = {
          fid,
          username: row.username as string | null,
          displayName: row.displayName as string | null,
          pfpUrl: row.pfpUrl as string | null,
        }

        result.set(fid, metadata)
        foundInTurso.add(fid)

        // Cachear en Redis también
        redisPipeline.setex(CACHE_KEYS.user(fid), CACHE_TTL.user, metadata)
      }

      // Guardar en Redis (batch)
      if (cached.rows.length > 0) {
        await redisPipeline.exec().catch(error => {
          console.warn("[users.ts] Failed to cache in Redis:", error instanceof Error ? error.message : error)
        })
      }

      // Actualizar lista de missing
      missingAfterRedis = missingAfterRedis.filter(fid => !foundInTurso.has(fid))

      if (process.env.REDIS_DEBUG === 'true') {
        console.log(`[users.ts] Turso: ${cached.rows.length} hits, ${missingAfterRedis.length} still missing`)
      }
    } catch (error) {
      console.warn("[users.ts] Turso error:", error instanceof Error ? error.message : error)
    }
  }

  // NIVEL 3: Fetch desde Neynar API (source of truth)
  if (fetchMissingFromNeynar && missingAfterRedis.length > 0) {
    try {
      const neynarResult = await fetchUsersBulk(missingAfterRedis)

      if (!("error" in neynarResult) && Array.isArray(neynarResult.data)) {
        const expiresAtMs = nowMs + DEFAULT_CACHE_TTL_MS

        const redisPipeline = redis.pipeline()
        const tursoValues: Array<{
          fid: number
          username: string
          displayName: string
          pfpUrl: string
          data: string
        }> = []

        for (const profile of neynarResult.data) {
          const metadata: UserMetadata = {
            fid: profile.fid,
            username: profile.username,
            displayName: profile.name,
            pfpUrl: profile.imageUrl,
          }

          result.set(profile.fid, metadata)

          // Guardar en Redis
          redisPipeline.setex(CACHE_KEYS.user(profile.fid), CACHE_TTL.user, metadata)

          // Preparar para Turso
          tursoValues.push({
            fid: profile.fid,
            username: profile.username,
            displayName: profile.name,
            pfpUrl: profile.imageUrl,
            data: JSON.stringify(profile),
          })
        }

        // Guardar en Redis (batch)
        await redisPipeline.exec().catch(error => {
          console.warn("[users.ts] Failed to cache Neynar data in Redis:", error instanceof Error ? error.message : error)
        })

        // Guardar en Turso (batch)
        const chunkSize = 100
        for (let i = 0; i < tursoValues.length; i += chunkSize) {
          const chunk = tursoValues.slice(i, i + chunkSize)
          const valuesSql = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",")
          const args = chunk.flatMap((v) => [
            v.fid,
            v.username,
            v.displayName,
            v.pfpUrl,
            v.data,
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
            console.warn("[users.ts] Turso cache write error:", error instanceof Error ? error.message : error)
          }
        }

        if (process.env.REDIS_DEBUG === 'true') {
          console.log(`[users.ts] Neynar: fetched ${neynarResult.data.length} users`)
        }
      }
    } catch (error) {
      console.warn("[users.ts] Neynar fetch error:", error instanceof Error ? error.message : error)
    }
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

/**
 * Invalida el cache de usuarios en Redis (útil para tests o forzar refresh)
 */
export async function invalidateUserCache(fids?: number[]): Promise<number> {
  try {
    if (fids && fids.length > 0) {
      // Invalidar FIDs específicos
      const keys = fids.map(fid => CACHE_KEYS.user(fid))
      await redis.del(...keys)
      return keys.length
    } else {
      // Invalidar todos los users usando pattern
      let cursor = 0
      let deletedCount = 0

      do {
        const [newCursor, keys] = await redis.scan(cursor, {
          match: `${CACHE_KEYS.user(0).split(':').slice(0, -1).join(':')}:*`,
          count: 100,
        })

        cursor = newCursor

        if (keys.length > 0) {
          await redis.del(...keys)
          deletedCount += keys.length
        }
      } while (cursor !== 0)

      return deletedCount
    }
  } catch (error) {
    console.error("[users.ts] Failed to invalidate cache:", error instanceof Error ? error.message : error)
    return 0
  }
}
