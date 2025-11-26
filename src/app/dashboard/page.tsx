import prisma from "@/lib/prisma"
import { Users, Trophy, Activity, TrendingUp, Calendar, Zap } from "lucide-react"
import Image from "next/image"
import { LiveLeaderboard } from "@/components/dashboard/LiveLeaderboard"
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics"

export const dynamic = 'force-dynamic'

interface RecentVote {
    id: string
    username: string
    photoUrl: string | null
    brand1: string
    brand2: string
    brand3: string
    date: Date
}

async function getDashboardStats() {
    try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)

        const [
            userCount,
            brandCount,
            voteCount,
            votesToday,
            votesThisWeek,
            activeUsers,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.brand.count({ where: { banned: 0 } }),
            prisma.userBrandVote.count(),
            prisma.userBrandVote.count({
                where: { date: { gte: todayStart } }
            }),
            prisma.userBrandVote.count({
                where: { date: { gte: weekStart } }
            }),
            prisma.userBrandVote.groupBy({
                by: ['userId'],
                where: { date: { gte: weekStart } },
            }).then(r => r.length),
        ])

        return {
            userCount,
            brandCount,
            voteCount,
            votesToday,
            votesThisWeek,
            activeUsers,
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
            connectionError: true
        }
    }
}

async function getRecentVotes(): Promise<RecentVote[]> {
    try {
        const votes = await prisma.userBrandVote.findMany({
            take: 8,
            orderBy: { date: 'desc' },
            include: {
                user: { select: { username: true, photoUrl: true } },
                brand1: { select: { name: true } },
                brand2: { select: { name: true } },
                brand3: { select: { name: true } },
            }
        })

        return votes
            .filter(v => v.user && v.brand1 && v.brand2 && v.brand3)
            .map(v => ({
                id: v.id,
                username: v.user!.username,
                photoUrl: v.user!.photoUrl,
                brand1: v.brand1!.name,
                brand2: v.brand2!.name,
                brand3: v.brand3!.name,
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

export default async function DashboardPage() {
    const [stats, recentVotes] = await Promise.all([
        getDashboardStats(),
        getRecentVotes(),
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
            name: "Total Votes",
            value: stats.voteCount.toLocaleString(),
            icon: Activity,
            color: "text-green-400",
        },
        {
            name: "Votes Today",
            value: stats.votesToday.toLocaleString(),
            icon: Zap,
            color: "text-purple-400",
        },
        {
            name: "Votes This Week",
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
            <div>
                <h2 className="text-4xl font-black text-white font-display">Dashboard Overview</h2>
                <p className="text-zinc-500 mt-1 font-mono text-sm">Welcome back to the BRND administration panel.</p>
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
                    <div
                        key={stat.name}
                        className="card-gradient rounded-2xl p-5 flex flex-col justify-between group cursor-default"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white font-display">{stat.value}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mt-1">{stat.name}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Activity */}
                <div className="card-gradient rounded-xl p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Votes</h3>
                        <span className="text-[10px] font-mono text-zinc-500">{recentVotes.length} latest</span>
                    </div>
                    
                    {recentVotes.length > 0 ? (
                        <div className="space-y-3">
                            {recentVotes.map((vote) => (
                                <div key={vote.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                    {vote.photoUrl ? (
                                        <Image
                                            src={vote.photoUrl}
                                            alt={vote.username}
                                            width={32}
                                            height={32}
                                            className="rounded-full ring-1 ring-zinc-800"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">
                                            {vote.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white font-medium truncate">{vote.username}</p>
                                        <p className="text-xs text-zinc-500 truncate">
                                            🥇 {vote.brand1} · 🥈 {vote.brand2} · 🥉 {vote.brand3}
                                        </p>
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
                </div>

                {/* Live Leaderboard */}
                <LiveLeaderboard />
            </div>

            {/* Analytics Section */}
            <DashboardAnalytics />
        </div>
    )
}
