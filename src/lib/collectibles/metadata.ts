import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { COLLECTIBLES_CONTRACT_ADDRESS, COLLECTIBLES_CONTRACT_ABI } from "@/config/collectibles-contract"
import { getWithFallback } from "@/lib/redis"
import { canRenderImageSrc, normalizeImageSrc } from "@/lib/images/safe-src"

// Cache TTL for tokenURI (24 hours - immutable once minted)
const TOKEN_URI_CACHE_TTL = 86400

interface CollectibleMetadata {
    name?: string
    description?: string
    image?: string
    attributes?: Array<{ trait_type: string; value: string | number }>
}

// Pinata dedicated gateway with token for reliable IPFS access
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
const PINATA_GATEWAY_TOKEN = process.env.PINATA_GATEWAY_TOKEN || ""

const IPFS_GATEWAYS = [
    PINATA_GATEWAY, // Pinata first (most reliable with token)
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
]

const getRpcUrl = (): string => {
    const rpcUrls = (process.env.NEXT_PUBLIC_BASE_RPC_URLS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    return rpcUrls[0] || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
}

/**
 * Retry wrapper for RPC calls with exponential backoff for rate limit errors
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error
            // Check if it's a rate limit error (429)
            if (error instanceof Error && error.message.includes("429")) {
                const delay = baseDelayMs * Math.pow(2, attempt)
                console.warn(`[collectibles] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }
            throw error // Non-rate-limit errors fail immediately
        }
    }
    throw lastError
}

/**
 * Fetch tokenURI with Redis caching and retry logic
 */
async function getTokenUriCached(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    tokenId: number
): Promise<string | null> {
    const cacheKey = `collectible:tokenUri:${tokenId}`

    try {
        return await getWithFallback<string>(
            cacheKey,
            async () => {
                const tokenUri = await withRetry(() =>
                    client.readContract({
                        address: COLLECTIBLES_CONTRACT_ADDRESS,
                        abi: COLLECTIBLES_CONTRACT_ABI,
                        functionName: "tokenURI",
                        args: [BigInt(tokenId)],
                    })
                ) as string
                return tokenUri || ""
            },
            TOKEN_URI_CACHE_TTL
        )
    } catch (error) {
        console.error(`[collectibles] Failed to get tokenURI for token ${tokenId}:`, error)
        return null
    }
}

/**
 * Convert IPFS URI to HTTP gateway URL with Pinata token support
 */
const resolveIpfsUrl = (uri: string): string => {
    if (uri.startsWith("ipfs://") || uri.startsWith("ipfs/")) {
        const hash = uri.replace("ipfs://", "").replace("ipfs/", "")
        const baseUrl = `${PINATA_GATEWAY}${hash}`
        // Append token as query param for image URLs (works with Next.js Image)
        if (PINATA_GATEWAY_TOKEN) {
            return `${baseUrl}?pinataGatewayToken=${PINATA_GATEWAY_TOKEN}`
        }
        return baseUrl
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

    // Handle IPFS URIs - try Pinata first with token, then fallback to public gateways
    if (uri.startsWith("ipfs://") || uri.startsWith("ipfs/")) {
        const hash = uri.replace("ipfs://", "").replace("ipfs/", "")

        for (const gateway of IPFS_GATEWAYS) {
            try {
                const headers: HeadersInit = {}
                // Add Pinata token for Pinata gateway
                if (gateway === PINATA_GATEWAY && PINATA_GATEWAY_TOKEN) {
                    headers["x-pinata-gateway-token"] = PINATA_GATEWAY_TOKEN
                }

                const response = await fetch(`${gateway}${hash}`, {
                    headers,
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

        const tokenUri = await getTokenUriCached(client, tokenId)

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
            const inlineSrc = normalizeImageSrc(metadata.image)
            return canRenderImageSrc(inlineSrc) ? inlineSrc : null
        }

        // Resolve IPFS image URLs
        const resolved = normalizeImageSrc(resolveIpfsUrl(metadata.image))
        if (!canRenderImageSrc(resolved)) {
            console.warn(`[collectibles] Invalid image URL for token ${tokenId}`)
            return null
        }

        return resolved
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

    // Fetch in parallel with concurrency limit and delay between batches
    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 150 // 150ms between batches to avoid rate limiting

    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + BATCH_SIZE)
        const images = await Promise.all(batch.map(getCollectibleImageUrl))
        batch.forEach((tokenId, idx) => {
            results.set(tokenId, images[idx])
        })

        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tokenIds.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
        }
    }

    return results
}
