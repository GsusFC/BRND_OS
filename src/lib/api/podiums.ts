import IndexerAdapter from "@/lib/seasons/adapters/indexer"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"

export async function getRecentPodiums() {
    try {
        const { data: podiums } = await IndexerAdapter.getRecentPodiums(10)
        
        // Get all unique brand IDs for enrichment
        const brandIds = [...new Set(podiums.flatMap(p => p.brandIds))]
        const brandsMetadata = await getBrandsMetadata(brandIds)
        
        return podiums.map(podium => {
            const [brand1Id, brand2Id, brand3Id] = podium.brandIds
            const brand1 = brandsMetadata.get(brand1Id)
            const brand2 = brandsMetadata.get(brand2Id)
            const brand3 = brandsMetadata.get(brand3Id)
            
            return {
                id: podium.id,
                date: podium.date,
                username: podium.username ?? `FID ${podium.fid}`,
                userPhoto: podium.userPhoto,
                brand1: brand1 ? { id: brand1Id, name: brand1.name, imageUrl: brand1.imageUrl } : { id: brand1Id, name: `Brand #${brand1Id}`, imageUrl: null },
                brand2: brand2 ? { id: brand2Id, name: brand2.name, imageUrl: brand2.imageUrl } : { id: brand2Id, name: `Brand #${brand2Id}`, imageUrl: null },
                brand3: brand3 ? { id: brand3Id, name: brand3.name, imageUrl: brand3.imageUrl } : { id: brand3Id, name: `Brand #${brand3Id}`, imageUrl: null },
            }
        })
    } catch (error) {
        console.error('Error fetching podiums from indexer:', error)
        return []
    }
}
