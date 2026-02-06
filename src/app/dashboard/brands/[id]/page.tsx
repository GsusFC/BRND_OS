import turso from "@/lib/turso"
import { notFound } from "next/navigation"
import { ArrowLeft, Globe, ExternalLink, ArrowUpRight, MessageSquare, Heart, Repeat2, MessageCircle, Banknote, LayoutGrid, List, Wallet, Vote, TrendingUp, Trophy } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import clsx from "clsx"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchCastsByFid, fetchChannelCasts } from "@/lib/neynar"
import { normalizeFarcasterUrl } from "@/lib/farcaster-url"
import { fetchChannelByIdCached, fetchUserByUsernameCached } from "@/lib/farcaster-profile-cache"
import { getCollectiblesByBrand, getIndexerBrandById } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import prismaIndexer from "@/lib/prisma-indexer"
import prisma from "@/lib/prisma"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { UserAvatar } from "@/components/users/UserAvatar"
import { BrandWeeklyChart } from "@/components/brands/BrandWeeklyChart"
import { PodiumSpot } from "@/components/dashboard/podiums/PodiumViews"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const MYSQL_DISABLED = process.env.MYSQL_DISABLED === "true"

const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
]

const normalizeMetadataHash = (value: string) =>
    value.replace("ipfs://", "").replace(/^ipfs\//, "")

const getOnchainMetadataHash = async (brandId: number) => {
    const rpcUrls = (process.env.NEXT_PUBLIC_BASE_RPC_URLS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    const urls = rpcUrls.length > 0
        ? rpcUrls
        : [process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"]

    for (const url of urls) {
        try {
            const client = createPublicClient({ chain: base, transport: http(url) })
            const result = await client.readContract({
                address: BRND_CONTRACT_ADDRESS,
                abi: BRND_CONTRACT_ABI,
                functionName: "getBrand",
                args: [brandId],
            })
            const metadataHash = (result as { metadataHash?: string }).metadataHash
            if (metadataHash) return metadataHash
        } catch {
            // try next RPC
        }
    }
    return null
}

const fetchMetadataFromIpfs = async (hash: string) => {
    const normalized = normalizeMetadataHash(hash)
    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetch(`${gateway}${normalized}`, { cache: "no-store" })
            if (!response.ok) continue
            return await response.json()
        } catch {
            // Try next gateway
        }
    }
    return null
}

const normalizeIpfsUrl = (value?: string | null) => {
    if (!value) return null
    if (value.startsWith("ipfs://") || value.startsWith("ipfs/")) {
        return `${IPFS_GATEWAYS[0]}${normalizeMetadataHash(value)}`
    }
    return value
}

const resolveCategoryById = async (categoryId: number) => {
    if (!Number.isFinite(categoryId) || categoryId <= 0) return null
    const tursoCategory = await turso.execute({
        sql: "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
        args: [categoryId],
    }).catch(() => null)
    const tursoRow = tursoCategory?.rows[0]
    if (tursoRow) {
        return { id: Number(tursoRow.id), name: String(tursoRow.name) }
    }
    if (!MYSQL_DISABLED) {
        try {
            const mysqlCategory = await prisma.category.findUnique({
                where: { id: categoryId },
                select: { id: true, name: true },
            })
            if (mysqlCategory) {
                return { id: Number(mysqlCategory.id), name: String(mysqlCategory.name) }
            }
        } catch (error) {
            console.warn("[brand] Category lookup failed:", error instanceof Error ? error.message : error)
        }
    }
    return null
}

function parseBrandIds(brandIdsJson: string): number[] {
    try {
        const parsed = JSON.parse(brandIdsJson)
        if (Array.isArray(parsed)) {
            return parsed.map(Number).filter(n => Number.isFinite(n))
        }
        return []
    } catch {
        console.warn(`Failed to parse brand_ids: ${brandIdsJson}`)
        return []
    }
}

const normalizeChannelId = (input: string): string => {
    const trimmed = input.trim()
    if (trimmed.length === 0) return ""
    const withoutPrefix = trimmed.replace(/^[@/]+/, "")
    const withoutQuery = withoutPrefix.split("?")[0] ?? ""
    const withoutHash = withoutQuery.split("#")[0] ?? ""
    const withoutPath = withoutHash.split("/")[0] ?? ""
    return withoutPath.trim()
}

const formatBrndAmount = (value: string | number): string => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(value)
    if (!Number.isFinite(parsed)) return String(value)
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.trunc(parsed))
}

interface BrandPageProps {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ view?: string; page?: string }>
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
    const { id } = await params
    const brandId = parseInt(id)

    const resolvedSearchParams = await searchParams
    const view = resolvedSearchParams?.view === "cards" ? "cards" : "list"
    const currentPage = Math.max(1, parseInt(resolvedSearchParams?.page || "1", 10))

    if (isNaN(brandId)) notFound()

    // Fetch Brand from Turso (write db metadata) and Indexer (metrics) in parallel
    const [tursoBrandRowResult, indexerBrand, indexerRow] = await Promise.all([
        turso.execute({
            sql: "SELECT * FROM brands WHERE id = ? LIMIT 1",
            args: [brandId],
        }).catch((error) => {
            console.warn("[brand] Turso brand lookup failed:", error instanceof Error ? error.message : error)
            return null
        }),
        getIndexerBrandById(brandId),
        prismaIndexer.indexerBrand.findUnique({
            where: { id: brandId },
            select: { metadata_hash: true },
        }).catch(() => null),
    ])

    const tursoBrandRow = tursoBrandRowResult?.rows[0]
    const tursoCategoryIdRaw = tursoBrandRow?.categoryId
    const tursoCategoryId =
        tursoCategoryIdRaw === null || tursoCategoryIdRaw === undefined ? null : Number(tursoCategoryIdRaw)

    const tursoCategory = tursoCategoryId
        ? await turso.execute({
            sql: "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
            args: [tursoCategoryId],
        }).catch((error) => {
            console.warn("[brand] Turso category lookup failed:", error instanceof Error ? error.message : error)
            return null
        })
        : null

    const tursoCategoryRow = tursoCategory?.rows[0]
    const tursoBrand = tursoBrandRow
        ? {
            id: brandId,
            name: String(tursoBrandRow.name ?? `Brand #${brandId}`),
            imageUrl: tursoBrandRow.imageUrl === null || tursoBrandRow.imageUrl === undefined ? null : String(tursoBrandRow.imageUrl),
            url: tursoBrandRow.url === null || tursoBrandRow.url === undefined ? undefined : String(tursoBrandRow.url),
            warpcastUrl: tursoBrandRow.warpcastUrl === null || tursoBrandRow.warpcastUrl === undefined ? undefined : String(tursoBrandRow.warpcastUrl),
            channel: tursoBrandRow.channel === null || tursoBrandRow.channel === undefined ? undefined : String(tursoBrandRow.channel),
            profile: tursoBrandRow.profile === null || tursoBrandRow.profile === undefined ? undefined : String(tursoBrandRow.profile),
            description: tursoBrandRow.description === null || tursoBrandRow.description === undefined ? undefined : String(tursoBrandRow.description),
            category: tursoCategoryRow ? { id: Number(tursoCategoryRow.id), name: String(tursoCategoryRow.name) } : null,
        }
        : null

    if (!tursoBrand && !indexerBrand) notFound()

    let metadataHash = indexerBrand?.metadataHash || indexerRow?.metadata_hash || null
    if (!metadataHash) {
        metadataHash = await getOnchainMetadataHash(brandId)
    }

    const needsIpfsFallback = Boolean(
        metadataHash && (
            !tursoBrand?.description ||
            !tursoBrand?.category ||
            !tursoBrand?.name ||
            !tursoBrand?.imageUrl ||
            !tursoBrand?.channel ||
            !tursoBrand?.url ||
            !tursoBrand?.warpcastUrl ||
            !tursoBrand?.profile
        )
    )

    let ipfsFallback: {
        name?: string
        imageUrl?: string | null
        url?: string
        warpcastUrl?: string
        profile?: string
        channel?: string
        description?: string
        category?: { id: number; name: string } | null
    } | null = null

    if (needsIpfsFallback && metadataHash) {
        const ipfsMetadata = await fetchMetadataFromIpfs(metadataHash)
        const ipfsDescription = typeof ipfsMetadata?.description === "string" ? ipfsMetadata.description : undefined
        const ipfsName = typeof ipfsMetadata?.name === "string" ? ipfsMetadata.name : undefined
        const ipfsImageUrlRaw =
            typeof ipfsMetadata?.imageUrl === "string"
                ? ipfsMetadata.imageUrl
                : typeof ipfsMetadata?.image === "string"
                    ? ipfsMetadata.image
                    : undefined
        const ipfsImageUrl = normalizeIpfsUrl(ipfsImageUrlRaw)
        const ipfsUrl = typeof ipfsMetadata?.url === "string" ? ipfsMetadata.url : undefined
        const ipfsWarpcastUrl =
            typeof ipfsMetadata?.warpcastUrl === "string"
                ? ipfsMetadata.warpcastUrl
                : typeof ipfsMetadata?.warpcast_url === "string"
                    ? ipfsMetadata.warpcast_url
                    : undefined
        const ipfsProfile = typeof ipfsMetadata?.profile === "string" ? ipfsMetadata.profile : undefined
        const ipfsChannel =
            typeof ipfsMetadata?.channel === "string"
                ? ipfsMetadata.channel
                : typeof ipfsMetadata?.channelId === "string"
                    ? ipfsMetadata.channelId
                    : undefined
        const ipfsCategoryId = Number(ipfsMetadata?.categoryId)
        const ipfsCategory = Number.isFinite(ipfsCategoryId) && ipfsCategoryId > 0
            ? await resolveCategoryById(ipfsCategoryId)
            : null
        if (
            ipfsDescription ||
            ipfsCategory ||
            ipfsName ||
            ipfsImageUrl ||
            ipfsUrl ||
            ipfsWarpcastUrl ||
            ipfsProfile ||
            ipfsChannel
        ) {
            ipfsFallback = {
                name: ipfsName,
                imageUrl: ipfsImageUrl,
                url: ipfsUrl,
                warpcastUrl: ipfsWarpcastUrl,
                profile: ipfsProfile,
                channel: ipfsChannel,
                description: ipfsDescription,
                category: ipfsCategory,
            }
        }
    }

    let mysqlFallback: { description?: string; category?: { id: number; name: string } | null } | null = null
    if (!MYSQL_DISABLED && (!tursoBrand?.description || !tursoBrand?.category)) {
        try {
            const mysqlBrand = await prisma.brand.findUnique({
                where: { id: brandId },
                select: {
                    description: true,
                    category: { select: { id: true, name: true } },
                },
            })
            if (mysqlBrand) {
                mysqlFallback = {
                    description: mysqlBrand.description ?? undefined,
                    category: mysqlBrand.category
                        ? { id: Number(mysqlBrand.category.id), name: String(mysqlBrand.category.name) }
                        : null,
                }
            }
        } catch (error) {
            console.warn("[brand] MySQL fallback failed:", error instanceof Error ? error.message : error)
        }
    }

    const brand = {
        id: brandId,
        name: tursoBrand?.name ?? ipfsFallback?.name ?? indexerBrand?.name ?? `Brand #${brandId}`,
        imageUrl: tursoBrand?.imageUrl ?? ipfsFallback?.imageUrl ?? indexerBrand?.imageUrl,
        url: tursoBrand?.url ?? ipfsFallback?.url,
        warpcastUrl: tursoBrand?.warpcastUrl ?? ipfsFallback?.warpcastUrl,
        channel: tursoBrand?.channel ?? ipfsFallback?.channel ?? indexerBrand?.channel,
        profile: tursoBrand?.profile ?? ipfsFallback?.profile,
        description: tursoBrand?.description || ipfsFallback?.description || mysqlFallback?.description,
        category: tursoBrand?.category ?? ipfsFallback?.category ?? mysqlFallback?.category ?? null,
        tags: [] as Array<{ tag?: { id: number; name: string } | null }>,
        walletAddress: indexerBrand?.walletAddress ?? null,
        // Metrics: prefer Indexer (S2) — already normalized (divided by 1e18) in adapter
        allTimePoints: indexerBrand?.allTimePoints ?? 0,
        allTimeRank: indexerBrand?.allTimeRank ?? null,
        goldCount: indexerBrand?.goldCount ?? 0,
        silverCount: indexerBrand?.silverCount ?? 0,
        bronzeCount: indexerBrand?.bronzeCount ?? 0,
        weeklyPoints: indexerBrand?.weeklyPoints ?? 0,
        weeklyRank: indexerBrand?.weeklyRank ?? null,
    }

    const brandVoteWhere = {
        OR: [
            { brand_ids: { contains: `[${brandId},` } },
            { brand_ids: { contains: `,${brandId},` } },
            { brand_ids: { contains: `,${brandId}]` } },
            { brand_ids: { equals: `[${brandId}]` } },
        ],
    }

    // Fetch votes, withdrawals, collectibles, and weekly history for this brand from Indexer
    const [recentVotes, totalVotesCount, brandWithdrawals, brandCollectibles, weeklyHistory] = await Promise.all([
        prismaIndexer.indexerVote.findMany({
            where: brandVoteWhere,
            orderBy: { timestamp: 'desc' },
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prismaIndexer.indexerVote.count({ where: brandVoteWhere }),
        prismaIndexer.indexerBrandRewardWithdrawal.findMany({
            where: { brand_id: brandId },
            orderBy: { timestamp: 'desc' },
            take: 10,
        }),
        getCollectiblesByBrand(brandId, 6),
        prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
            where: { brand_id: brandId },
            orderBy: { week: 'asc' },
        }),
    ])

    // Get voter metadata
    const voterFids = [...new Set(recentVotes.map(v => v.fid))]
    const votersMetadata = await getUsersMetadata(voterFids)

    const topVoters = recentVotes.map(vote => {
        const brandIds = parseBrandIds(vote.brand_ids)
        const position = brandIds.indexOf(brandId)
        const voter = votersMetadata.get(vote.fid)
        return {
            id: vote.id,
            fid: vote.fid,
            username: voter?.username ?? `fid:${vote.fid}`,
            photoUrl: voter?.pfpUrl ?? null,
            position: position === 0 ? 'gold' : position === 1 ? 'silver' : 'bronze',
            timestamp: new Date(Number(vote.timestamp) * 1000),
        }
    })

    const totalPages = Math.max(1, Math.ceil(totalVotesCount / PAGE_SIZE))
    const prevPage = Math.max(1, currentPage - 1)
    const nextPage = Math.min(totalPages, currentPage + 1)

    // Fetch Neynar data (channel info + recent casts)
    let recentCasts: { hash: string; author: { username: string; pfpUrl: string }; text: string; timestamp: string; likes: number; recasts: number; replies: number }[] = []
    
    const channelFromBrand = brand.channel ? normalizeChannelId(brand.channel) : ""
    const channelFromProfile = brand.profile ? normalizeChannelId(brand.profile.replace("@", "").split(".")[0] ?? "") : ""
    const channelId = channelFromBrand || channelFromProfile || null
    
    if (channelId) {
        try {
            const [channelResult, userResult] = await Promise.all([
                fetchChannelByIdCached(channelId),
                fetchUserByUsernameCached(channelId)
            ])
            
            // Try to get casts from User Profile first (most accurate for "person" brands)
            if ('success' in userResult && userResult.success) {
                const castsResult = await fetchCastsByFid(userResult.data.fid, 5)
                if ('success' in castsResult && castsResult.success && castsResult.data.length > 0) {
                    recentCasts = castsResult.data
                }
            } 
            
            // If no user casts, try Channel Lead (for "channel" brands)
            if (recentCasts.length === 0 && 'success' in channelResult && channelResult.success && channelResult.data.lead?.fid) {
                const castsResult = await fetchCastsByFid(channelResult.data.lead.fid, 5)
                if ('success' in castsResult && castsResult.success && castsResult.data.length > 0) {
                    recentCasts = castsResult.data
                }
            }
            
            // Fallback: Fetch general channel casts (might be noisy)
            if (recentCasts.length === 0) {
                const castsResult = await fetchChannelCasts(channelId, 5)
                if ('success' in castsResult && castsResult.success) {
                    recentCasts = castsResult.data
                }
            }
        } catch (error) {
            console.error('[Neynar] Fetch error for brand:', brandId, channelId, error)
        }
    }

    const collectibleBrandIds = new Set<number>()
    for (const collectible of brandCollectibles) {
        collectibleBrandIds.add(collectible.goldBrandId)
        collectibleBrandIds.add(collectible.silverBrandId)
        collectibleBrandIds.add(collectible.bronzeBrandId)
    }

    const collectibleMetadata = await getBrandsMetadata(Array.from(collectibleBrandIds))

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
            {/* Navigation */}
            <Button asChild variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-white text-zinc-500 uppercase tracking-widest font-bold text-sm">
                <Link href="/dashboard/brands">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Brands
                </Link>
            </Button>

            {/* Header / Hero */}
            <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-4xl md:text-6xl font-black font-display text-white uppercase">
                            {brand.name}
                        </h1>
                        <Badge variant="outline" className="bg-gradient-to-r from-purple-950/50 to-blue-950/50 border-purple-500/30 text-purple-300">
                            Season 2
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                        {brand.url && (
                            <Button asChild variant="link" className="text-zinc-500 hover:text-white p-0 h-auto text-sm">
                                <a href={brand.url} target="_blank" rel="noopener noreferrer">
                                    <Globe className="w-4 h-4 mr-1" />
                                    {new URL(brand.url).hostname}
                                </a>
                            </Button>
                        )}
                        {normalizeFarcasterUrl(brand.warpcastUrl) && (
                            <Button asChild variant="link" className="text-[#855DCD] hover:text-[#a37ce6] p-0 h-auto text-sm">
                                <a href={normalizeFarcasterUrl(brand.warpcastUrl) ?? ""} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    /channel
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Brand Logo */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[22%] bg-[#212020] border border-[#484E55] overflow-hidden shadow-2xl">
                    {brand.imageUrl ? (
                        <Image src={brand.imageUrl} alt={brand.name} width={96} height={96} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-500 font-display">
                            {brand.name.charAt(0)}
                        </div>
                    )}
                </div>
            </div>

            {/* Wallet Address */}
            {brand.walletAddress && (
                <div className="flex items-center gap-2 mb-4 px-1">
                    <Wallet className="w-3.5 h-3.5 text-zinc-600" />
                    <a
                        href={`https://basescan.org/address/${brand.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-zinc-600 hover:text-white transition-colors"
                    >
                        {brand.walletAddress.slice(0, 6)}...{brand.walletAddress.slice(-4)}
                    </a>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                {/* All-Time Points */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
                    {brand.allTimeRank && brand.allTimeRank <= 10 && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            Top 10
                        </div>
                    )}
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">All-Time Pts</div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                        {brand.allTimePoints.toLocaleString()}
                    </div>
                </div>

                {/* Rank */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between group">
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">All-Time Rank</div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                        #{brand.allTimeRank ?? "-"}
                    </div>
                </div>

                {/* Weekly */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between group">
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">This Week</div>
                    <div>
                        <div className="text-xl md:text-2xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                            {brand.weeklyPoints.toLocaleString()}
                        </div>
                        {brand.weeklyRank && (
                            <div className="text-[10px] text-zinc-500 mt-1">Rank #{brand.weeklyRank}</div>
                        )}
                    </div>
                </div>

                {/* Total Votes */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between group">
                    <div className="flex items-center gap-1.5">
                        <Vote className="w-3 h-3 text-zinc-600" />
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Votes</div>
                    </div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300 mt-3">
                        {totalVotesCount.toLocaleString()}
                    </div>
                </div>

                {/* Collectibles */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between group">
                    <div className="flex items-center gap-1.5">
                        <Trophy className="w-3 h-3 text-zinc-600" />
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Collectibles</div>
                    </div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300 mt-3">
                        {brandCollectibles.length}
                    </div>
                </div>

                {/* Category */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between group">
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Category</div>
                    <div className="text-lg md:text-xl font-black font-display text-white uppercase break-words leading-tight group-hover:scale-105 transition-transform duration-300">
                        {brand.category?.name || "General"}
                    </div>
                </div>
            </div>

            {/* Description */}
            {brand.description && (
                <Card className="rounded-3xl p-8 mb-4 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Description</div>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {brand.description}
                    </p>
                    {brand.tags && brand.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-900">
                            {brand.tags.filter(t => t.tag).map((t) => (
                                <Badge key={t.tag!.id} variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">
                                    {t.tag!.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Weekly Score History */}
            {weeklyHistory.length > 1 && (
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50 mb-4">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Weekly Score History</div>
                        <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/30 ml-auto">
                            {weeklyHistory.length} weeks
                        </Badge>
                    </div>
                    <BrandWeeklyChart data={weeklyHistory.map(w => ({
                        week: `W${w.week.toString()}`,
                        score: Math.round(Number(w.points) / 1e18),
                        gold: w.gold_count,
                        silver: w.silver_count,
                        bronze: w.bronze_count,
                    }))} />
                </Card>
            )}

            {/* Third Row: Podium & Voters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Podium Stats */}
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8">Podium Stats (All-Time)</div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥇</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{brand.goldCount}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Gold</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥈</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{brand.silverCount}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Silver</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥉</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{brand.bronzeCount}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Bronze</div>
                        </div>
                    </div>
                </Card>

                {/* Recent Podiums */}
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Podiums</div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500 font-mono">{topVoters.length} shown</span>

                            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                                <Link
                                    href={`/dashboard/brands/${brandId}?view=list&page=1`}
                                    className={clsx(
                                        "p-2 rounded-md transition-colors",
                                        view === "list" ? "bg-white text-black" : "text-zinc-500 hover:text-white",
                                    )}
                                    title="List view"
                                    aria-label="List view"
                                >
                                    <List className="w-4 h-4" />
                                </Link>
                                <Link
                                    href={`/dashboard/brands/${brandId}?view=cards&page=1`}
                                    className={clsx(
                                        "p-2 rounded-md transition-colors",
                                        view === "cards" ? "bg-white text-black" : "text-zinc-500 hover:text-white",
                                    )}
                                    title="Cards view"
                                    aria-label="Cards view"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {topVoters.length === 0 ? (
                        <div className="text-zinc-600 text-xs uppercase tracking-widest text-center py-8">No podiums yet</div>
                    ) : (
                        <div className="max-h-[380px] overflow-y-auto pr-2">
                            {view === "list" ? (
                                <div className="space-y-4">
                                    {topVoters.map((vote) => (
                                        <Link key={vote.id} href={`/dashboard/users/${vote.fid}`} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-surface overflow-hidden shrink-0">
                                                    {vote.photoUrl ? (
                                                        <Image src={vote.photoUrl} alt={vote.username} width={32} height={32} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                                                            {vote.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors truncate">
                                                        {vote.username}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-600 font-mono">
                                                        {vote.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>

                                            <Badge variant="outline" className="text-[10px] py-0.5 shrink-0">
                                                {vote.position === 'gold' ? '🥇 Gold' : vote.position === 'silver' ? '🥈 Silver' : '🥉 Bronze'}
                                            </Badge>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {topVoters.map((vote) => (
                                        <Link key={vote.id} href={`/dashboard/users/${vote.fid}`} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:bg-zinc-900/60 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[10px] py-0.5">
                                                    {vote.position === 'gold' ? '🥇 Gold' : vote.position === 'silver' ? '🥈 Silver' : '🥉 Bronze'}
                                                </Badge>
                                                <span className="text-xs text-zinc-600 font-mono">
                                                    {vote.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-surface overflow-hidden shrink-0">
                                                    {vote.photoUrl ? (
                                                        <Image src={vote.photoUrl} alt={vote.username} width={40} height={40} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-500">
                                                            {vote.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white truncate">{vote.username}</div>
                                                    <div className="text-[10px] text-zinc-600 font-mono">FID {vote.fid}</div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-zinc-800">
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                disabled={currentPage <= 1}
                                className={currentPage <= 1 ? "opacity-50 pointer-events-none" : ""}
                            >
                                <Link href={`/dashboard/brands/${brandId}?view=${view}&page=${prevPage}`}>
                                    ← Prev
                                </Link>
                            </Button>

                            <span className="text-xs text-zinc-500 font-mono px-3">
                                Page {currentPage} of {totalPages}
                            </span>

                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                disabled={currentPage >= totalPages}
                                className={currentPage >= totalPages ? "opacity-50 pointer-events-none" : ""}
                            >
                                <Link href={`/dashboard/brands/${brandId}?view=${view}&page=${nextPage}`}>
                                    Next →
                                </Link>
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Collectibles featuring this brand */}
            {brandCollectibles.length > 0 && (
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50 mb-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-purple-400" />
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Collectibles</div>
                        </div>
                        <Link href="/dashboard/collectibles" className="text-xs font-mono text-zinc-500 hover:text-white transition-colors">
                            View all
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {brandCollectibles.map((collectible) => {
                            const goldMeta = collectibleMetadata.get(collectible.goldBrandId)
                            const silverMeta = collectibleMetadata.get(collectible.silverBrandId)
                            const bronzeMeta = collectibleMetadata.get(collectible.bronzeBrandId)
                            const goldBrand = {
                                id: collectible.goldBrandId,
                                name: goldMeta?.name ?? `Brand #${collectible.goldBrandId}`,
                                imageUrl: goldMeta?.imageUrl ?? null,
                            }
                            const silverBrand = {
                                id: collectible.silverBrandId,
                                name: silverMeta?.name ?? `Brand #${collectible.silverBrandId}`,
                                imageUrl: silverMeta?.imageUrl ?? null,
                            }
                            const bronzeBrand = {
                                id: collectible.bronzeBrandId,
                                name: bronzeMeta?.name ?? `Brand #${collectible.bronzeBrandId}`,
                                imageUrl: bronzeMeta?.imageUrl ?? null,
                            }

                            return (
                                <Link
                                    key={collectible.tokenId}
                                    href={`/dashboard/collectibles/${collectible.tokenId}`}
                                    className="rounded-2xl border border-zinc-800 bg-black/40 overflow-hidden hover:border-zinc-600 hover:bg-zinc-900/60 transition-all group"
                                >
                                    <div className="p-4">
                                        <div className="h-[250px] overflow-hidden flex items-end justify-center">
                                            <div className="flex items-end justify-center gap-2 origin-bottom scale-[0.6]">
                                                <PodiumSpot place="silver" brand={silverBrand} />
                                                <PodiumSpot place="gold" brand={goldBrand} />
                                                <PodiumSpot place="bronze" brand={bronzeBrand} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="p-4 pt-2 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-mono text-zinc-600">#{collectible.tokenId}</span>
                                            <span className="text-[10px] font-mono text-zinc-400">{formatBrndAmount(collectible.currentPrice)} BRND</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-mono text-zinc-700">{collectible.claimCount} claims</span>
                                            <span className="text-[9px] font-mono text-zinc-700">
                                                {collectible.lastUpdated ? collectible.lastUpdated.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </Card>
            )}

            {/* Brand Withdrawals */}
            {brandWithdrawals.length > 0 && (
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50 mb-4">
                    <div className="flex items-center gap-2 mb-6">
                        <Banknote className="w-4 h-4 text-orange-500" />
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">BRND Withdrawals</div>
                        <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-400 border-orange-500/30 ml-auto">
                            {brandWithdrawals.length} total
                        </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {brandWithdrawals.map((withdrawal) => (
                            <div key={withdrawal.id} className="p-4 rounded-xl bg-black/50 border border-zinc-900">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg font-bold text-orange-400 font-display">
                                        {(Number(withdrawal.amount) / 1e18).toFixed(4)}
                                    </span>
                                    <span className="text-[10px] text-zinc-600 font-mono">BRND</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <a 
                                        href={`https://basescan.org/tx/${withdrawal.transaction_hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-zinc-500 hover:text-white transition-colors"
                                    >
                                        {withdrawal.transaction_hash.slice(0, 10)}...
                                    </a>
                                    <span className="text-zinc-600 font-mono">
                                        {new Date(Number(withdrawal.timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Recent Casts */}
            {recentCasts.length > 0 && (
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50 mt-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-purple-400" />
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Recent Casts</div>
                        </div>
                        <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                            via Neynar
                        </Badge>
                    </div>
                    <div className="space-y-4">
                        {recentCasts.map((cast) => (
                            <div key={cast.hash} className="p-4 rounded-xl bg-black/50 border border-zinc-900 hover:border-zinc-700 transition-colors">
                                <div className="flex items-start gap-3">
                                    <UserAvatar 
                                        src={cast.author.pfpUrl} 
                                        alt={cast.author.username} 
                                        size={32} 
                                        className="w-8 h-8" 
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-white">@{cast.author.username}</span>
                                            <span className="text-[10px] text-zinc-600">
                                                {new Date(cast.timestamp).toLocaleDateString('es-ES', { 
                                                    day: 'numeric', 
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">
                                            {cast.text}
                                        </p>
                                        <div className="flex items-center gap-4 mt-3 text-zinc-500">
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <Heart className="w-3.5 h-3.5" />
                                                <span>{cast.likes}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <Repeat2 className="w-3.5 h-3.5" />
                                                <span>{cast.recasts}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                <span>{cast.replies}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}
