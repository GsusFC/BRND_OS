import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"

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
        const brands = await prisma.brand.findMany({
            where: { banned: 0 },
            select: { id: true, name: true, imageUrl: true, score: true },
            orderBy: { score: "desc" },
            take: 100,
        })

        return brands as BrandInfo[]
    },
    ['brand-evolution-brands'],
    { revalidate: 300, tags: ['brands', 'evolution'] }
)
