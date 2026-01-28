import { Users, Trophy, Activity, TrendingUp, Calendar, Zap, Gem } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { LiveLeaderboardServer } from "@/components/dashboard/LiveLeaderboardServer"
import { DashboardAnalyticsServer } from "@/components/dashboard/DashboardAnalyticsServer"
import { BrandEvolutionServer } from "@/components/dashboard/BrandEvolutionServer"
import { PodiumInsightsWrapper } from "@/components/dashboard/PodiumInsightsWrapper"
import { LatestCollectibles } from "@/components/dashboard/LatestCollectibles"
import { getRecentPodiums, getIndexerStats, SeasonRegistry, getRecentCollectibles } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { CACHE_KEYS, CACHE_TTL, getWithFallback } from "@/lib/redis"

export const dynamic = 'force-dynamic'

interface RecentVote {
    id: string
    odiumId: number
    username: string
    photoUrl: string | null
    brand1: { id: number; name: string }
    brand2: { id: number; name: string }
    brand3: { id: number; name: string }
    date: Date | string | null
}

async function getDashboardStatsFresh() {
    try {
        const stats = await getIndexerStats()
        const currentRound = SeasonRegistry.getCurrentRound()

        return {
            userCount: stats.totalUsers,
            brandCount: stats.totalBrands,
            voteCount: stats.totalVotes,
            votesToday: stats.votesToday,
            votesThisWeek: stats.votesThisWeek,
            activeUsers: stats.activeUsersWeek,
            roundNumber: currentRound?.roundNumber ?? 0,
            connectionError: false
        }
    } catch (error) {
        console.warn("⚠️ Could not fetch dashboard stats:", error instanceof Error ? error.message : error)
        return {
            userCount: 0,
            brandCount: 0,
            voteCount: 0,
            votesToday: 0,
            votesThisWeek: 0,
            activeUsers: 0,
            roundNumber: 0,
            connectionError: true
        }
    }
}

async function getDashboardStats() {
    return getWithFallback(
        CACHE_KEYS.dashboardStats(),
        async () => getDashboardStatsFresh(),
        CACHE_TTL.dashboardStats
    )
}

async function getRecentVotes(): Promise<RecentVote[]> {
    return getWithFallback<RecentVote[]>(
        CACHE_KEYS.recentVotes(),
        async () => {
            const podiums = await getRecentPodiums(20)

            // Get all unique brand IDs to enrich
            const allBrandIds = new Set<number>()
            for (const vote of podiums.data) {
                for (const brandId of vote.brandIds) {
                    allBrandIds.add(brandId)
                }
            }

            // Enrich with brand metadata
            const brandsMetadata = await getBrandsMetadata(Array.from(allBrandIds))

            return podiums.data
                .filter(v => v.brandIds.length >= 3)
                .map(v => {
                    const brand1 = brandsMetadata.get(v.brandIds[0])
                    const brand2 = brandsMetadata.get(v.brandIds[1])
                    const brand3 = brandsMetadata.get(v.brandIds[2])

                    return {
                        id: v.id,
                        odiumId: v.fid,
                        username: v.username ?? `FID ${v.fid}`,
                        photoUrl: v.userPhoto,
                        brand1: { id: v.brandIds[0], name: brand1?.name ?? `Brand #${v.brandIds[0]}` },
                        brand2: { id: v.brandIds[1], name: brand2?.name ?? `Brand #${v.brandIds[1]}` },
                        brand3: { id: v.brandIds[2], name: brand3?.name ?? `Brand #${v.brandIds[2]}` },
                        date: v.date,
                    }
                })
        },
        CACHE_TTL.recentVotes
    )
}

type RecentCollectible = {
    tokenId: number
    gold: { id: number; name: string; imageUrl: string | null }
    silver: { id: number; name: string; imageUrl: string | null }
    bronze: { id: number; name: string; imageUrl: string | null }
    price: string
    claimCount: number
    lastUpdated: Date | null
}

async function getRecentCollectiblesList(): Promise<RecentCollectible[]> {
    const collectibles = await getRecentCollectibles(6)
    const brandIds = new Set<number>()

    for (const item of collectibles) {
        brandIds.add(item.goldBrandId)
        brandIds.add(item.silverBrandId)
        brandIds.add(item.bronzeBrandId)
    }

    const metadata = await getBrandsMetadata(Array.from(brandIds))

    return collectibles.map((item) => ({
        tokenId: item.tokenId,
        gold: {
            id: item.goldBrandId,
            name: metadata.get(item.goldBrandId)?.name ?? `Brand #${item.goldBrandId}`,
            imageUrl: metadata.get(item.goldBrandId)?.imageUrl ?? null,
        },
        silver: {
            id: item.silverBrandId,
            name: metadata.get(item.silverBrandId)?.name ?? `Brand #${item.silverBrandId}`,
            imageUrl: metadata.get(item.silverBrandId)?.imageUrl ?? null,
        },
        bronze: {
            id: item.bronzeBrandId,
            name: metadata.get(item.bronzeBrandId)?.name ?? `Brand #${item.bronzeBrandId}`,
            imageUrl: metadata.get(item.bronzeBrandId)?.imageUrl ?? null,
        },
        price: item.currentPrice,
        claimCount: item.claimCount,
        lastUpdated: item.lastUpdated,
    }))
}

function timeAgo(date: Date | string | null): string {
    if (!date) return "just now"
    const parsed = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(parsed.getTime())) return "just now"
    const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default async function DashboardPage() {
    const [stats, recentVotes, recentCollectibles] = await Promise.all([
        getDashboardStats(),
        getRecentVotes(),
        getRecentCollectiblesList(),
    ])

    const statCards = [
        {
            name: "Total Users",
            value: stats.userCount.toLocaleString(),
            icon: Users,
            color: "text-blue-400",
        },
        {
            name: "Active Brands",
            value: stats.brandCount.toLocaleString(),
            icon: Trophy,
            color: "text-yellow-400",
        },
        {
            name: "Total Podiums",
            value: stats.voteCount.toLocaleString(),
            icon: Activity,
            color: "text-green-400",
        },
        {
            name: "Podiums Today",
            value: stats.votesToday.toLocaleString(),
            icon: Zap,
            color: "text-purple-400",
        },
        {
            name: "Podiums This Week",
            value: stats.votesThisWeek.toLocaleString(),
            icon: Calendar,
            color: "text-pink-400",
        },
        {
            name: "Active Users (7d)",
            value: stats.activeUsers.toLocaleString(),
            icon: TrendingUp,
            color: "text-cyan-400",
        },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-white font-display uppercase">Onchain Season</h2>
                    <p className="text-zinc-500 mt-1 font-mono text-sm">Live data from the Indexer</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-3xl font-black text-white font-display uppercase">Round {stats.roundNumber}</span>
                </div>
            </div>

            {stats.connectionError && (
                <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        <p className="text-sm font-mono text-yellow-200">
                            ⚠️ Database connection unavailable. Showing cached data.
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Grid - 6 cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {statCards.map((stat) => (
                    <Card
                        key={stat.name}
                        variant="gradient"
                        className="rounded-2xl p-5 flex flex-col justify-between group cursor-default"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white font-display uppercase">{stat.value}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mt-1">{stat.name}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Activity - altura fija igual al Leaderboard (10 marcas) */}
                <Card className="rounded-xl p-6 flex flex-col h-[720px] bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex items-center justify-between mb-5 shrink-0">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Podiums</h3>
                        <span className="text-[10px] font-mono text-zinc-500">{recentVotes.length} latest</span>
                    </div>

                    {recentVotes.length > 0 ? (
                        <div className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-1">
                            {recentVotes.map((vote) => (
                                <div key={vote.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                    <Link href={`/dashboard/users/${vote.odiumId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                        {vote.photoUrl ? (
                                            <Image
                                                src={vote.photoUrl}
                                                alt={vote.username}
                                                width={28}
                                                height={28}
                                                className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-800"
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">
                                                {vote.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-sm text-white font-medium truncate w-[90px]">{vote.username}</span>
                                    </Link>
                                    <div className="h-5 w-[2px] bg-zinc-600 rounded-full shrink-0" />
                                    <div className="flex items-center gap-3 text-xs flex-1">
                                        <Link href={`/dashboard/brands/${vote.brand1.id}`} className="text-zinc-400 hover:text-white transition-colors truncate">
                                            🥇 {vote.brand1.name}
                                        </Link>
                                        <Link href={`/dashboard/brands/${vote.brand2.id}`} className="text-zinc-400 hover:text-white transition-colors truncate">
                                            🥈 {vote.brand2.name}
                                        </Link>
                                        <Link href={`/dashboard/brands/${vote.brand3.id}`} className="text-zinc-400 hover:text-white transition-colors truncate">
                                            🥉 {vote.brand3.name}
                                        </Link>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap">
                                        {timeAgo(vote.date)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800">
                            <p className="text-zinc-600 font-mono text-sm">No recent votes</p>
                        </div>
                    )}
                </Card>

                {/* Live Leaderboard - Server Component with Suspense */}
                <LiveLeaderboardServer />
            </div>

            {/* Latest Collectibles */}
            <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Gem className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Latest Collectibles</h3>
                    </div>
                    <Link href="/dashboard/collectibles" className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors">
                        View all
                    </Link>
                </div>

                <LatestCollectibles
                    items={recentCollectibles.map((item) => ({
                        tokenId: item.tokenId,
                        gold: item.gold,
                        silver: item.silver,
                        bronze: item.bronze,
                        price: item.price,
                        claimCount: item.claimCount,
                        lastUpdatedLabel: timeAgo(item.lastUpdated),
                    }))}
                />
            </Card>

            {/* Analytics Section - Server Component with Suspense */}
            <DashboardAnalyticsServer />

            {/* Brand Evolution Chart - Server Component with Suspense */}
            <BrandEvolutionServer />

            {/* Podium Insights */}
            <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-xl">📈</span>
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">Podium Insights</h2>
                    <span className="text-xs font-mono text-zinc-500">Last 60 days</span>
                </div>
                <PodiumInsightsWrapper />
            </div>
        </div>
    )
}
