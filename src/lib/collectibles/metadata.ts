import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { COLLECTIBLES_CONTRACT_ADDRESS, COLLECTIBLES_CONTRACT_ABI } from "@/config/collectibles-contract"

interface CollectibleMetadata {
    name?: string
    description?: string
    image?: string
    attributes?: Array<{ trait_type: string; value: string | number }>
}

const getRpcUrl = (): string => {
    const rpcUrls = (process.env.NEXT_PUBLIC_BASE_RPC_URLS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    return rpcUrls[0] || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
}

/**
 * Fetch tokenURI from the collectibles contract and resolve the metadata JSON.
 * Returns the image URL if available.
 */
export async function getCollectibleImageUrl(tokenId: number): Promise<string | null> {
    try {
        const client = createPublicClient({
            chain: base,
            transport: http(getRpcUrl()),
        })

        const tokenUri = await client.readContract({
            address: COLLECTIBLES_CONTRACT_ADDRESS,
            abi: COLLECTIBLES_CONTRACT_ABI,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
        }) as string

        if (!tokenUri) return null

        // Handle IPFS URIs
        let metadataUrl = tokenUri
        if (tokenUri.startsWith("ipfs://")) {
            metadataUrl = `https://ipfs.io/ipfs/${tokenUri.replace("ipfs://", "")}`
        }

        // Fetch metadata JSON
        const response = await fetch(metadataUrl, { next: { revalidate: 3600 } }) // Cache 1 hour
        if (!response.ok) return null

        const metadata = (await response.json()) as CollectibleMetadata
        if (!metadata.image) return null

        // Handle IPFS image URLs
        let imageUrl = metadata.image
        if (imageUrl.startsWith("ipfs://")) {
            imageUrl = `https://ipfs.io/ipfs/${imageUrl.replace("ipfs://", "")}`
        }

        return imageUrl
    } catch (error) {
        console.error(`[collectibles] Failed to get image for token ${tokenId}:`, error)
        return null
    }
}

/**
 * Batch fetch collectible images for multiple tokenIds.
 * Returns a Map of tokenId → imageUrl (null if not found).
 */
export async function getCollectibleImages(tokenIds: number[]): Promise<Map<number, string | null>> {
    const results = new Map<number, string | null>()

    // Fetch in parallel with concurrency limit
    const BATCH_SIZE = 5
    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + BATCH_SIZE)
        const images = await Promise.all(batch.map(getCollectibleImageUrl))
        batch.forEach((tokenId, idx) => {
            results.set(tokenId, images[idx])
        })
    }

    return results
}
