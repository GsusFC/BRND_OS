import prisma from "@/lib/prisma"
import { Users, Trophy, Activity, TrendingUp, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { LiveLeaderboardWrapper } from "@/components/dashboard/LiveLeaderboardWrapper"
import { DashboardAnalyticsWrapper } from "@/components/dashboard/DashboardAnalyticsWrapper"
import { BrandEvolutionWrapper } from "@/components/dashboard/BrandEvolutionWrapper"

export const dynamic = 'force-dynamic'

const BASE_PATH = "/dashboard/season-1"

interface RecentVote {
    id: string
    odiumId: number
    username: string
    photoUrl: string | null
    brand1: { id: number; name: string }
    brand2: { id: number; name: string }
    brand3: { id: number; name: string }
    date: Date
}

async function getStats() {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)
        weekStart.setHours(0, 0, 0, 0)

        const [totalBrands, totalUsers, votesToday, votesThisWeek, recentUsers] = await Promise.all([
            prisma.brand.count({ where: { banned: 0 } }),
            prisma.user.count(),
            prisma.userBrandVote.count({ where: { date: { gte: today } } }),
            prisma.userBrandVote.count({ where: { date: { gte: weekStart } } }),
            prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
        ])

        return {
            totalBrands,
            totalUsers,
            votesToday,
            votesThisWeek,
            activeUsers: recentUsers,
            connectionError: false
        }
    } catch (error) {
        console.warn("⚠️ Could not fetch stats:", error instanceof Error ? error.message : error)
        return {
            totalBrands: 0,
            totalUsers: 0,
            votesToday: 0,
            votesThisWeek: 0,
            activeUsers: 0,
            connectionError: true
        }
    }
}

async function getRecentVotes(): Promise<RecentVote[]> {
    try {
        const votes = await prisma.userBrandVote.findMany({
            take: 20,
            orderBy: { date: 'desc' },
            include: {
                user: { select: { id: true, username: true, photoUrl: true } },
                brand1: { select: { id: true, name: true } },
                brand2: { select: { id: true, name: true } },
                brand3: { select: { id: true, name: true } },
            }
        })

        return votes
            .filter(v => v.user && v.brand1 && v.brand2 && v.brand3)
            .map(v => ({
                id: v.id,
                odiumId: v.user!.id,
                username: v.user!.username,
                photoUrl: v.user!.photoUrl,
                brand1: { id: v.brand1!.id, name: v.brand1!.name },
                brand2: { id: v.brand2!.id, name: v.brand2!.name },
                brand3: { id: v.brand3!.id, name: v.brand3!.name },
                date: v.date,
            }))
    } catch (error) {
        console.warn("⚠️ Could not fetch recent votes:", error instanceof Error ? error.message : error)
        return []
    }
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default async function Season1DashboardPage() {
    const [stats, recentVotes] = await Promise.all([
        getStats(),
        getRecentVotes(),
    ])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white font-display uppercase tracking-tight">
                        Season 1 Dashboard
                    </h1>
                    <p className="text-zinc-500 font-mono text-sm mt-1">
                        Legacy data from MySQL database
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                    <span className="text-xs font-mono text-zinc-400">Season 1 • Legacy</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-purple-500/10">
                            <Trophy className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 font-mono">Total Brands</p>
                            <p className="text-2xl font-black text-white font-display">
                                {stats.totalBrands.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-blue-500/10">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 font-mono">Total Users</p>
                            <p className="text-2xl font-black text-white font-display">
                                {stats.totalUsers.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-green-500/10">
                            <Activity className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 font-mono">Votes Today</p>
                            <p className="text-2xl font-black text-white font-display">
                                {stats.votesToday.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-orange-500/10">
                            <TrendingUp className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 font-mono">Weekly Votes</p>
                            <p className="text-2xl font-black text-white font-display">
                                {stats.votesThisWeek.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Podiums */}
                <Card className="lg:col-span-2 rounded-xl p-6 border-[#484E55] bg-[#212020]">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-black text-white font-display uppercase">Recent Podiums</h2>
                        <span className="text-xs text-zinc-500 font-mono">Last 20 votes</span>
                    </div>

                    {stats.connectionError ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 rounded-full bg-red-950/30 mb-4">
                                <Activity className="w-8 h-8 text-red-400" />
                            </div>
                            <p className="text-zinc-400 font-mono text-sm">Connection error</p>
                            <p className="text-zinc-600 font-mono text-xs mt-1">Could not load recent votes</p>
                        </div>
                    ) : recentVotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 rounded-full bg-zinc-800 mb-4">
                                <Zap className="w-8 h-8 text-zinc-500" />
                            </div>
                            <p className="text-zinc-400 font-mono text-sm">No recent votes</p>
                            <p className="text-zinc-600 font-mono text-xs mt-1">Votes will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {recentVotes.map((vote) => (
                                <div
                                    key={vote.id}
                                    className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
                                >
                                    <Link href={`${BASE_PATH}/users/${vote.odiumId}`} className="shrink-0">
                                        {vote.photoUrl ? (
                                            <Image
                                                src={vote.photoUrl}
                                                alt={vote.username}
                                                width={36}
                                                height={36}
                                                className="rounded-full ring-2 ring-zinc-700"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center ring-2 ring-zinc-700">
                                                <Users className="w-4 h-4 text-zinc-500" />
                                            </div>
                                        )}
                                    </Link>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`${BASE_PATH}/users/${vote.odiumId}`}
                                                className="font-bold text-zinc-300 hover:text-white transition-colors truncate"
                                            >
                                                {vote.username}
                                            </Link>
                                            <span className="text-zinc-600 text-xs font-mono shrink-0">
                                                {timeAgo(vote.date)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                                            <Link href={`${BASE_PATH}/brands/${vote.brand1.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors">
                                                <span>🥇</span>
                                                <span className="truncate max-w-[80px]">{vote.brand1.name}</span>
                                            </Link>
                                            <Link href={`${BASE_PATH}/brands/${vote.brand2.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 transition-colors">
                                                <span>🥈</span>
                                                <span className="truncate max-w-[80px]">{vote.brand2.name}</span>
                                            </Link>
                                            <Link href={`${BASE_PATH}/brands/${vote.brand3.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                                                <span>🥉</span>
                                                <span className="truncate max-w-[80px]">{vote.brand3.name}</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Weekly Leaderboard */}
                <LiveLeaderboardWrapper />
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardAnalyticsWrapper />
                <BrandEvolutionWrapper />
            </div>
        </div>
    )
}
