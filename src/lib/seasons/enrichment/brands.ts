/**
 * Enriquecimiento de brands del Indexer
 * Obtiene metadata (nombre, imagen, channel) desde MySQL
 */

import prisma from "@/lib/prisma"

export interface BrandMetadata {
  id: number
  name: string
  imageUrl: string | null
  channel: string | null
}

type BrandCache = Map<number, BrandMetadata>

let brandCache: BrandCache | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Obtiene metadata de brands desde MySQL (con cache en memoria)
 */
async function loadBrandCache(): Promise<BrandCache> {
  const now = Date.now()
  
  if (brandCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return brandCache
  }

  const brands = await prisma.brand.findMany({
    where: { banned: 0 },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      channel: true,
    },
  })

  brandCache = new Map(
    brands.map((b) => [
      b.id,
      {
        id: b.id,
        name: b.name,
        imageUrl: b.imageUrl,
        channel: b.channel,
      },
    ])
  )
  cacheTimestamp = now

  return brandCache
}

/**
 * Obtiene metadata de un brand por ID
 */
export async function getBrandMetadata(brandId: number): Promise<BrandMetadata | null> {
  const cache = await loadBrandCache()
  return cache.get(brandId) ?? null
}

/**
 * Obtiene metadata de múltiples brands por IDs
 */
export async function getBrandsMetadata(brandIds: number[]): Promise<Map<number, BrandMetadata>> {
  const cache = await loadBrandCache()
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
