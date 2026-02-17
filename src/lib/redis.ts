import { Redis } from '@upstash/redis'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

function createUnavailableRedisClient(message: string): Redis {
    const error = () => {
        throw new Error(message)
    }

    return {
        get: error,
        mget: error,
        set: error,
        setex: error,
        del: error,
        pipeline: () => ({
            setex: () => ({ exec: error }),
            exec: error,
        }),
    } as unknown as Redis
}

// Cliente Redis singleton
export const redis: Redis = redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
        // Opciones de retry
        automaticDeserialization: true,
        retry: {
            retries: 3,
            backoff: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 3000),
        },
    })
    : createUnavailableRedisClient('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')

// Cache key patterns (namespace para evitar colisiones)
export const CACHE_KEYS = {
    // Brand metadata
    brand: (id: number) => `brnd:brand:meta:v1:${id}`,
    brandBulk: () => 'brnd:brand:meta:v1',

    // User metadata
    user: (fid: number) => `brnd:user:meta:v1:${fid}`,
    userBulk: () => 'brnd:user:meta:v1',

    // Leaderboards
    leaderboardWeekly: (week?: string) => week
        ? `brnd:leaderboard:weekly:v1:${week}`
        : 'brnd:leaderboard:weekly:v1:current',
    leaderboardAllTime: () => 'brnd:leaderboard:alltime:v1',

    // Dashboard stats
    dashboardStats: () => 'brnd:dashboard:stats:v1',
    recentVotes: () => 'brnd:dashboard:recent_votes:v1',

    // Analytics
    analyticsDaily: (date?: string) => date
        ? `brnd:analytics:daily:v1:${date}`
        : `brnd:analytics:daily:v1:${new Date().toISOString().split('T')[0]}`,

    // Locks para cache warming
    lock: (resource: string) => `brnd:lock:${resource}`,

    // Intelligence query cache
    intelligenceQuery: (hash: string) => `brnd:intelligence:query:v1:${hash}`,
} as const

// TTL (Time To Live) en segundos
export const CACHE_TTL = {
    brand: 60 * 60,              // 1 hora (metadata cambia poco)
    user: 6 * 60 * 60,           // 6 horas (Farcaster profiles)
    leaderboard: 5 * 60,         // 5 minutos (data dinámica)
    dashboardStats: 5 * 60,      // 5 minutos
    recentVotes: 2 * 60,         // 2 minutos (más fresco)
    analytics: 24 * 60 * 60,     // 24 horas (histórico)
    lock: 30,                    // 30 segundos (locks cortos)
    intelligenceQuery: 60 * 60,  // 1 hora (queries repetidas)
} as const

// Helper: Obtener con fallback
export async function getWithFallback<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
): Promise<T> {
    try {
        // Intentar desde cache
        const cached = await redis.get<T>(key)

        if (cached !== null && cached !== undefined) {
            return cached
        }

        // Cache miss: ejecutar fallback
        const fresh = await fallback()

        // Guardar en cache
        if (ttl) {
            await redis.setex(key, ttl, fresh)
        } else {
            await redis.set(key, fresh)
        }

        return fresh
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Hide auth errors from logs to avoid spam if credentials are wrong
        if (errorMessage.includes('WRONGPASS') || errorMessage.includes('unauthorized')) {
            // Silently fallback without logging every time
            return fallback()
        }

        console.error(`Redis error for key ${key}:`, error)
        // Si Redis falla, ejecutar fallback sin cache
        return fallback()
    }
}

// Helper: Batch get con fallback parcial
export async function mgetWithFallback<T>(
    keys: string[],
    fallback: (missingKeys: string[]) => Promise<Map<string, T>>,
    ttl?: number
): Promise<Map<string, T>> {
    const result = new Map<string, T>()

    if (keys.length === 0) {
        return result
    }

    try {
        // Batch get desde Redis
        const cached = await redis.mget<T[]>(...keys)

        const missingKeys: string[] = []

        for (let i = 0; i < keys.length; i++) {
            const value = cached[i]
            if (value !== null && value !== undefined) {
                result.set(keys[i], value)
            } else {
                missingKeys.push(keys[i])
            }
        }

        // Si hay keys que faltan, ejecutar fallback
        if (missingKeys.length > 0) {
            const freshData = await fallback(missingKeys)

            // Guardar en Redis usando pipeline (1 round-trip)
            if (ttl && freshData.size > 0) {
                const pipeline = redis.pipeline()
                for (const [key, value] of freshData.entries()) {
                    pipeline.setex(key, ttl, value)
                }
                await pipeline.exec()
            }

            // Agregar al resultado
            for (const [key, value] of freshData.entries()) {
                result.set(key, value)
            }
        }

        return result
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('WRONGPASS') || errorMessage.includes('unauthorized')) {
            return fallback(keys)
        }

        console.error('Redis mget error:', error)
        // Si Redis falla, ejecutar fallback para todas las keys
        return fallback(keys)
    }
}

// Helper: Adquirir lock distribuido
export async function acquireLock(
    resource: string,
    ttl: number = CACHE_TTL.lock
): Promise<boolean> {
    try {
        const lockKey = CACHE_KEYS.lock(resource)
        const acquired = await redis.set(lockKey, '1', { ex: ttl, nx: true })
        return acquired === 'OK'
    } catch (error) {
        console.error(`Failed to acquire lock for ${resource}:`, error)
        return false
    }
}

// Helper: Liberar lock
export async function releaseLock(resource: string): Promise<void> {
    try {
        const lockKey = CACHE_KEYS.lock(resource)
        await redis.del(lockKey)
    } catch (error) {
        console.error(`Failed to release lock for ${resource}:`, error)
    }
}

// Helper: Ejecutar con lock (auto-release)
export async function withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options?: { ttl?: number; waitTime?: number }
): Promise<T | null> {
    const { ttl = CACHE_TTL.lock, waitTime = 5000 } = options || {}

    const acquired = await acquireLock(resource, ttl)

    if (!acquired) {
        // Esperar con exponential backoff
        const maxRetries = 5
        for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), waitTime)))

            const retryAcquired = await acquireLock(resource, ttl)
            if (retryAcquired) {
                break
            }

            if (i === maxRetries - 1) {
                console.warn(`Failed to acquire lock for ${resource} after ${maxRetries} retries`)
                return null
            }
        }
    }

    try {
        return await fn()
    } finally {
        await releaseLock(resource)
    }
}

// Helper: Invalidar cache por pattern
export async function invalidateByPattern(pattern: string): Promise<number> {
    try {
        // Nota: Upstash Redis soporta SCAN
        let cursor = "0"
        let deletedCount = 0

        do {
            const [newCursor, keys] = await redis.scan(cursor, {
                match: pattern,
                count: 100,
            })

            cursor = newCursor

            if (keys.length > 0) {
                await redis.del(...keys)
                deletedCount += keys.length
            }
        } while (cursor !== "0")

        return deletedCount
    } catch (error) {
        console.error(`Failed to invalidate pattern ${pattern}:`, error)
        return 0
    }
}

// Type exports para conveniencia
export type CacheKey = ReturnType<typeof CACHE_KEYS[keyof typeof CACHE_KEYS]>
