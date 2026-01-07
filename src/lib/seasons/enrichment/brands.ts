/**
 * Enriquecimiento de brands del Indexer
 * Obtiene metadata (nombre, imagen, channel) desde MySQL
 * Cache distribuido con Redis (Upstash)
 * Fallback: usa snapshot estático si MySQL no disponible
 */

import prisma from "@/lib/prisma"
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis"
import brandsSnapshot from "@/../public/data/brands.json"

export interface BrandMetadata {
  id: number
  name: string
  imageUrl: string | null
  channel: string | null
}

const staticBrands = brandsSnapshot as Record<string, { name: string; imageUrl: string | null; channel: string | null }>

/**
 * Obtiene metadata de brands desde MySQL con cache en Redis
 */
async function loadBrandCache(brandIds: number[]): Promise<Map<number, BrandMetadata>> {
  const result = new Map<number, BrandMetadata>()

  // Filtrar y deduplicar IDs
  const uniqueBrandIds = [...new Set(brandIds)].filter((id) => Number.isFinite(id) && id > 0)

  if (uniqueBrandIds.length === 0) {
    return result
  }

  // Paso 1: Intentar obtener desde Redis (batch get)
  const redisKeys = uniqueBrandIds.map(id => CACHE_KEYS.brand(id))
  const missingIds: number[] = []

  try {
    const cachedValues = await redis.mget<BrandMetadata[]>(...redisKeys)

    // Identificar hits y misses
    for (let i = 0; i < uniqueBrandIds.length; i++) {
      const cached = cachedValues[i]
      if (cached && typeof cached === 'object' && 'id' in cached) {
        result.set(uniqueBrandIds[i], cached)
      } else {
        missingIds.push(uniqueBrandIds[i])
      }
    }

    // Logging para debugging
    if (process.env.REDIS_DEBUG === 'true') {
      console.log(`[brands.ts] Cache: ${result.size} hits, ${missingIds.length} misses`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('WRONGPASS') && !errorMessage.includes('unauthorized')) {
      console.warn("[brands.ts] Redis unavailable, fetching from MySQL:", errorMessage)
    }
    // Si Redis falla, todos son misses
    missingIds.push(...uniqueBrandIds)
  }

  // Paso 2: Fetch missing desde MySQL
  if (missingIds.length > 0) {
    try {
      const brands = await prisma.brand.findMany({
        where: {
          banned: 0,
          id: { in: missingIds },
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          channel: true,
        },
      })

      // Preparar para batch write a Redis
      const pipeline = redis.pipeline()
      const foundIds = new Set<number>()

      for (const b of brands) {
        const metadata: BrandMetadata = {
          id: b.id,
          name: b.name,
          imageUrl: b.imageUrl,
          channel: b.channel,
        }

        result.set(b.id, metadata)
        foundIds.add(b.id)

        // Agregar a pipeline
        pipeline.setex(CACHE_KEYS.brand(b.id), CACHE_TTL.brand, metadata)
      }

      // Ejecutar pipeline (1 round-trip)
      if (brands.length > 0) {
        await pipeline.exec().catch(error => {
          const errMsg = error instanceof Error ? error.message : String(error)
          if (!errMsg.includes('WRONGPASS') && !errMsg.includes('unauthorized')) {
            console.warn("[brands.ts] Failed to cache brands in Redis:", errMsg)
          }
        })
      }

      // Paso 3: Fallback a snapshot estático para IDs no encontrados
      const notFoundIds = missingIds.filter(id => !foundIds.has(id))

      if (notFoundIds.length > 0) {
        console.warn(`[brands.ts] ${notFoundIds.length} brands not found in MySQL, using static snapshot`)

        for (const id of notFoundIds) {
          const staticBrand = staticBrands[String(id)]
          if (staticBrand) {
            const metadata: BrandMetadata = {
              id,
              name: staticBrand.name,
              imageUrl: staticBrand.imageUrl,
              channel: staticBrand.channel,
            }
            result.set(id, metadata)

            // Cache snapshot data también
            redis.setex(CACHE_KEYS.brand(id), CACHE_TTL.brand, metadata).catch(() => {
              // Silently fail si Redis no disponible
            })
          }
        }
      }
    } catch (error) {
      console.warn("[brands.ts] MySQL unavailable, using static snapshot:", error instanceof Error ? error.message : error)

      // Fallback completo a snapshot estático
      for (const id of missingIds) {
        const staticBrand = staticBrands[String(id)]
        if (staticBrand) {
          const metadata: BrandMetadata = {
            id,
            name: staticBrand.name,
            imageUrl: staticBrand.imageUrl,
            channel: staticBrand.channel,
          }
          result.set(id, metadata)
        }
      }
    }
  }

  return result
}

/**
 * Obtiene metadata de un brand por ID
 */
export async function getBrandMetadata(brandId: number): Promise<BrandMetadata | null> {
  const cache = await loadBrandCache([brandId])
  return cache.get(brandId) ?? null
}

/**
 * Obtiene metadata de múltiples brands por IDs
 */
export async function getBrandsMetadata(brandIds: number[]): Promise<Map<number, BrandMetadata>> {
  return loadBrandCache(brandIds)
}

/**
 * Enriquece un array de objetos que tienen brand_id con metadata
 */
export async function enrichWithBrandMetadata<T extends { id: number }>(
  items: T[]
): Promise<(T & { name: string; imageUrl: string | null; channel: string | null })[]> {
  const brandIds = items.map((item) => item.id)
  const metadata = await getBrandsMetadata(brandIds)

  return items.map((item) => {
    const brand = metadata.get(item.id)
    return {
      ...item,
      name: brand?.name ?? `Brand #${item.id}`,
      imageUrl: brand?.imageUrl ?? null,
      channel: brand?.channel ?? null,
    }
  })
}

/**
 * Invalida el cache en Redis (útil para tests o después de actualizar brands)
 */
export async function invalidateBrandCache(brandIds?: number[]): Promise<number> {
  try {
    if (brandIds && brandIds.length > 0) {
      // Invalidar IDs específicos
      const keys = brandIds.map(id => CACHE_KEYS.brand(id))
      await redis.del(...keys)
      return keys.length
    } else {
      // Invalidar todos los brands usando pattern
      let cursor = "0"
      let deletedCount = 0

      do {
        const [newCursor, keys] = await redis.scan(cursor, {
          match: `${CACHE_KEYS.brand(0).split(':').slice(0, -1).join(':')}:*`,
          count: 100,
        })

        cursor = newCursor

        if (keys.length > 0) {
          await redis.del(...keys)
          deletedCount += keys.length
        }
      } while (cursor !== "0")

      return deletedCount
    }
  } catch (error) {
    console.error("[brands.ts] Failed to invalidate cache:", error instanceof Error ? error.message : error)
    return 0
  }
}
