/**
 * Enriquecimiento de brands del Indexer
 * Obtiene metadata (nombre, imagen, channel) desde MySQL
 * Fallback: usa snapshot estático si MySQL no disponible
 */

import prisma from "@/lib/prisma"
import brandsSnapshot from "@/../public/data/brands.json"

export interface BrandMetadata {
  id: number
  name: string
  imageUrl: string | null
  channel: string | null
}

type BrandCache = Map<number, BrandMetadata>

const staticBrands = brandsSnapshot as Record<string, { name: string; imageUrl: string | null; channel: string | null }>

let brandCache: BrandCache | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Obtiene metadata de brands desde MySQL (con cache en memoria)
 */
async function loadBrandCache(brandIds: number[]): Promise<BrandCache> {
  const now = Date.now()
  
  if (!brandCache || now - cacheTimestamp >= CACHE_TTL_MS) {
    brandCache = new Map()
    cacheTimestamp = now
  }

  const uniqueBrandIds = [...new Set(brandIds)].filter((id) => Number.isFinite(id) && id > 0)
  const missingIds = uniqueBrandIds.filter((id) => !brandCache!.has(id))

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

      for (const b of brands) {
        brandCache.set(b.id, {
          id: b.id,
          name: b.name,
          imageUrl: b.imageUrl,
          channel: b.channel,
        })
      }
    } catch (error) {
      console.warn("[brands.ts] MySQL unavailable, using static snapshot:", error instanceof Error ? error.message : error)
      // Use static snapshot as fallback
      for (const id of missingIds) {
        const staticBrand = staticBrands[String(id)]
        if (staticBrand) {
          brandCache!.set(id, {
            id,
            name: staticBrand.name,
            imageUrl: staticBrand.imageUrl,
            channel: staticBrand.channel,
          })
        }
      }
    }
  }

  return brandCache
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
  const cache = await loadBrandCache(brandIds)
  const result = new Map<number, BrandMetadata>()

  for (const id of brandIds) {
    const metadata = cache.get(id)
    if (metadata) {
      result.set(id, metadata)
    }
  }

  return result
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
 * Invalida el cache (útil para tests o después de actualizar brands)
 */
export function invalidateBrandCache(): void {
  brandCache = null
  cacheTimestamp = 0
}
