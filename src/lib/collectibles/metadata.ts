import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { COLLECTIBLES_CONTRACT_ADDRESS, COLLECTIBLES_CONTRACT_ABI } from "@/config/collectibles-contract"

interface CollectibleMetadata {
    name?: string
    description?: string
    image?: string
    attributes?: Array<{ trait_type: string; value: string | number }>
}

const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
]

const getRpcUrl = (): string => {
    const rpcUrls = (process.env.NEXT_PUBLIC_BASE_RPC_URLS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    return rpcUrls[0] || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
}

/**
 * Convert IPFS URI to HTTP gateway URL
 */
const resolveIpfsUrl = (uri: string): string => {
    if (uri.startsWith("ipfs://")) {
        return `${IPFS_GATEWAYS[0]}${uri.replace("ipfs://", "")}`
    }
    if (uri.startsWith("ipfs/")) {
        return `${IPFS_GATEWAYS[0]}${uri.replace("ipfs/", "")}`
    }
    return uri
}

/**
 * Parse base64-encoded JSON data URI
 */
const parseDataUri = (dataUri: string): CollectibleMetadata | null => {
    try {
        // Handle: data:application/json;base64,<base64data>
        if (dataUri.startsWith("data:application/json;base64,")) {
            const base64Data = dataUri.replace("data:application/json;base64,", "")
            const jsonString = Buffer.from(base64Data, "base64").toString("utf-8")
            return JSON.parse(jsonString)
        }
        // Handle: data:application/json,<urlencodedJson>
        if (dataUri.startsWith("data:application/json,")) {
            const jsonString = decodeURIComponent(dataUri.replace("data:application/json,", ""))
            return JSON.parse(jsonString)
        }
        return null
    } catch {
        return null
    }
}

/**
 * Fetch metadata from URL with multiple gateway fallbacks for IPFS
 */
const fetchMetadata = async (uri: string): Promise<CollectibleMetadata | null> => {
    // Handle data URIs
    if (uri.startsWith("data:")) {
        return parseDataUri(uri)
    }

    // Handle IPFS URIs - try multiple gateways
    if (uri.startsWith("ipfs://") || uri.startsWith("ipfs/")) {
        const hash = uri.replace("ipfs://", "").replace("ipfs/", "")
        for (const gateway of IPFS_GATEWAYS) {
            try {
                const response = await fetch(`${gateway}${hash}`, {
                    next: { revalidate: 3600 },
                    signal: AbortSignal.timeout(10000), // 10s timeout
                })
                if (response.ok) {
                    return await response.json()
                }
            } catch {
                // Try next gateway
            }
        }
        return null
    }

    // Handle HTTP URLs
    try {
        const response = await fetch(uri, {
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) return null
        return await response.json()
    } catch {
        return null
    }
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

        if (!tokenUri) {
            console.warn(`[collectibles] Empty tokenURI for token ${tokenId}`)
            return null
        }

        // Fetch metadata (handles data URIs, IPFS, and HTTP)
        const metadata = await fetchMetadata(tokenUri)
        if (!metadata) {
            console.warn(`[collectibles] Failed to fetch metadata for token ${tokenId}, URI: ${tokenUri.slice(0, 100)}...`)
            return null
        }

        if (!metadata.image) {
            console.warn(`[collectibles] No image in metadata for token ${tokenId}`)
            return null
        }

        // Handle data URI images (SVG or base64)
        if (metadata.image.startsWith("data:")) {
            return metadata.image
        }

        // Resolve IPFS image URLs
        return resolveIpfsUrl(metadata.image)
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
