import prisma from "@/lib/prisma"
import turso from "@/lib/turso"
import { notFound } from "next/navigation"
import { ArrowLeft, Globe, ExternalLink, ArrowUpRight, MessageSquare, Heart, Repeat2, MessageCircle, Banknote, LayoutGrid, List } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import clsx from "clsx"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchCastsByFid, fetchChannelCasts } from "@/lib/neynar"
import { fetchChannelByIdCached, fetchUserByUsernameCached } from "@/lib/farcaster-profile-cache"
import { getIndexerBrandById } from "@/lib/seasons"
import prismaIndexer from "@/lib/prisma-indexer"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { UserAvatar } from "@/components/users/UserAvatar"

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

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

    // Fetch Brand from Turso (write db metadata), MySQL (legacy metadata), and Indexer (metrics) in parallel
    const [tursoBrandRowResult, mysqlBrand, indexerBrand] = await Promise.all([
        turso.execute({
            sql: "SELECT * FROM brands WHERE id = ? LIMIT 1",
            args: [brandId],
        }),
        prisma.brand.findUnique({
            where: { id: brandId },
            include: {
                category: true,
                tags: { include: { tag: true } }
            }
        }),
        getIndexerBrandById(brandId),
    ])

    const tursoBrandRow = tursoBrandRowResult.rows[0]
    const tursoCategoryIdRaw = tursoBrandRow?.categoryId
    const tursoCategoryId =
        tursoCategoryIdRaw === null || tursoCategoryIdRaw === undefined ? null : Number(tursoCategoryIdRaw)

    const tursoCategory = tursoCategoryId
        ? await turso.execute({
            sql: "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
            args: [tursoCategoryId],
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

    if (!tursoBrand && !mysqlBrand && !indexerBrand) notFound()

    const brand = {
        id: brandId,
        name: tursoBrand?.name ?? mysqlBrand?.name ?? indexerBrand?.name ?? `Brand #${brandId}`,
        imageUrl: tursoBrand?.imageUrl ?? mysqlBrand?.imageUrl ?? indexerBrand?.imageUrl,
        url: tursoBrand?.url ?? mysqlBrand?.url,
        warpcastUrl: tursoBrand?.warpcastUrl ?? mysqlBrand?.warpcastUrl,
        channel: tursoBrand?.channel ?? mysqlBrand?.channel ?? indexerBrand?.channel,
        profile: tursoBrand?.profile ?? mysqlBrand?.profile,
        description: tursoBrand?.description ?? mysqlBrand?.description,
        category: tursoBrand?.category ?? mysqlBrand?.category,
        tags: mysqlBrand?.tags ?? [],
        // Metrics: Prefer Indexer (S2), fallback to MySQL (Legacy/S1)
        allTimePoints: indexerBrand?.allTimePoints ?? mysqlBrand?.score ?? 0,
        allTimeRank: indexerBrand?.allTimeRank ?? (mysqlBrand?.currentRanking && mysqlBrand.currentRanking > 0 ? mysqlBrand.currentRanking : null),
        goldCount: indexerBrand?.goldCount ?? 0,
        silverCount: indexerBrand?.silverCount ?? 0,
        bronzeCount: indexerBrand?.bronzeCount ?? 0,
        weeklyPoints: indexerBrand?.weeklyPoints ?? mysqlBrand?.scoreWeek ?? 0,
        weeklyRank: indexerBrand?.weeklyRank ?? (mysqlBrand?.rankingWeek && mysqlBrand.rankingWeek > 0 ? mysqlBrand.rankingWeek : null),
        totalBrndAwarded: indexerBrand?.totalBrndAwarded ?? 0,
        availableBrnd: indexerBrand?.availableBrnd ?? 0,
    }

    const brandVoteWhere = {
        OR: [
            { brand_ids: { contains: `[${brandId},` } },
            { brand_ids: { contains: `,${brandId},` } },
            { brand_ids: { contains: `,${brandId}]` } },
            { brand_ids: { equals: `[${brandId}]` } },
        ],
    }

    // Fetch votes and withdrawals for this brand from Indexer
    const [recentVotes, totalVotesCount, brandWithdrawals] = await Promise.all([
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
                        {brand.warpcastUrl && (
                            <Button asChild variant="link" className="text-[#855DCD] hover:text-[#a37ce6] p-0 h-auto text-sm">
                                <a href={brand.warpcastUrl} target="_blank" rel="noopener noreferrer">
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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* All-Time Points */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square relative overflow-hidden group">
                    {brand.allTimeRank && brand.allTimeRank <= 10 && (
                        <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                            <ArrowUpRight className="w-3 h-3" />
                            Top 10
                        </div>
                    )}
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">All-Time Points</div>
                    <div className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                        {brand.allTimePoints.toLocaleString()}
                    </div>
                </div>

                {/* Rank */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">All-Time Rank</div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">Global</div>
                        <span className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                            #{brand.allTimeRank ?? "-"}
                        </span>
                    </div>
                </div>

                {/* Weekly */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">This Week</div>
                    <div>
                        <div className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                            {brand.weeklyPoints.toLocaleString()}
                        </div>
                        {brand.weeklyRank && (
                            <div className="text-xs text-zinc-500 mt-1">Rank #{brand.weeklyRank}</div>
                        )}
                    </div>
                </div>

                {/* Category */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Category</div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase break-words leading-tight group-hover:scale-105 transition-transform duration-300">
                        {brand.category?.name || "General"}
                    </div>
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Description */}
                <Card className="rounded-3xl p-8 lg:col-span-1 flex flex-col bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6">Description</div>
                    <h3 className="text-xl font-bold mb-4 text-white leading-tight">
                        {brand.name}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed flex-1">
                        {brand.description || "No description available for this brand."}
                    </p>
                    {brand.tags && brand.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-zinc-900">
                            {brand.tags.filter(t => t.tag).map((t) => (
                                <Badge key={t.tag!.id} variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">
                                    {t.tag!.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Card>

                {/* BRND Tokens */}
                <Card className="rounded-3xl p-8 lg:col-span-2 min-h-[300px] flex flex-col bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">BRND Tokens</div>
                        <Badge variant="outline" className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                            Onchain
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-6 flex-1">
                        <div className="flex flex-col justify-center">
                            <div className="text-[10px] font-bold text-zinc-600 uppercase mb-2">Total Awarded</div>
                            <div className="text-3xl font-black font-display text-yellow-500">
                                {(brand.totalBrndAwarded / 1e18).toFixed(2)}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">BRND</div>
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="text-[10px] font-bold text-zinc-600 uppercase mb-2">Available</div>
                            <div className="text-3xl font-black font-display text-green-500">
                                {(brand.availableBrnd / 1e18).toFixed(2)}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">BRND</div>
                        </div>
                    </div>
                </Card>
            </div>

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
