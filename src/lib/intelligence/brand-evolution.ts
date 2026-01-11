import { unstable_cache } from "next/cache"
import prismaIndexer from "@/lib/prisma-indexer"

export interface BrandInfo {
    id: number
    name: string
    imageUrl: string
    score: number
}

/**
 * Get available brands for evolution chart selection
 * Cached for 5 minutes to reduce database load
 */
export const getBrandsForEvolution = unstable_cache(
    async (): Promise<BrandInfo[]> => {
        const brands = await prismaIndexer.indexerBrand.findMany({
            select: { 
                id: true, 
                handle: true, 
                total_brnd_awarded: true 
            },
            orderBy: { total_brnd_awarded: "desc" },
            take: 100,
        })

        return brands.map(b => ({
            id: b.id,
            name: b.handle,
            imageUrl: '', // PostgreSQL schema doesn't have imageUrl
            score: Number(b.total_brnd_awarded)
        }))
    },
    ['brand-evolution-brands'],
    { revalidate: 300, tags: ['brands', 'evolution'] }
)
