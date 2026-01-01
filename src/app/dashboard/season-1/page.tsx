import { Users, Trophy, Activity, TrendingUp, Calendar, Award, BarChart3, PieChart } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import s1Meta from "@/../public/data/s1/meta.json"
import s1Summary from "@/../public/data/s1/summary.json"
import s1Timeseries from "@/../public/data/s1/timeseries.json"
import s1Toplists from "@/../public/data/s1/toplists.json"

export default function Season1ReportPage() {
    const meta = s1Meta
    const summary = s1Summary
    const timeseries = s1Timeseries
    const toplists = s1Toplists

    const maxVotes = Math.max(...timeseries.votesPerDay.map(d => d.count))

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black text-white font-display uppercase tracking-tight">
                            Season 1 Report
                        </h1>
                        <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-400">
                            Snapshot
                        </Badge>
                    </div>
                    <p className="text-zinc-500 font-mono text-sm">
                        Historical data • {summary.dateRange.from} → {summary.dateRange.to}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-600 font-mono uppercase">Generated</p>
                        <p className="text-xs text-zinc-400 font-mono">{new Date(meta.generatedAt).toLocaleDateString()}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="border border-zinc-700">
                        <Link href="/dashboard">
                            View Season 2 Live →
                        </Link>
                    </Button>
                </div>
            </div>

            {/* KPI Summary - Module 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">Total Users</span>
                    </div>
                    <p className="text-3xl font-black text-white font-display">
                        {summary.totalUsers.toLocaleString()}
                    </p>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <Trophy className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">Total Brands</span>
                    </div>
                    <p className="text-3xl font-black text-white font-display">
                        {summary.totalBrands.toLocaleString()}
                    </p>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Activity className="w-5 h-5 text-green-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">Total Podiums</span>
                    </div>
                    <p className="text-3xl font-black text-white font-display">
                        {summary.totalPodiums.toLocaleString()}
                    </p>
                </Card>

                <Card className="p-6 rounded-xl border-[#484E55] bg-[#212020]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                            <TrendingUp className="w-5 h-5 text-yellow-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">Total Votes</span>
                    </div>
                    <p className="text-3xl font-black text-white font-display">
                        {summary.totalVotes.toLocaleString()}
                    </p>
                </Card>
            </div>

            {/* Votes Over Time - Module 2 */}
            <Card className="rounded-xl p-6 border-[#484E55] bg-[#212020]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Votes Over Time</h2>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">{timeseries.votesPerDay.length} days</span>
                </div>
                
                <div className="h-40 flex items-end gap-[2px]">
                    {timeseries.votesPerDay.map((day) => (
                        <div
                            key={day.day}
                            className="flex-1 bg-blue-500/60 hover:bg-blue-400 transition-colors rounded-t cursor-pointer group relative"
                            style={{ height: `${(day.count / maxVotes) * 100}%`, minHeight: '4px' }}
                            title={`${day.day}: ${day.count} votes`}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 rounded text-[10px] text-white font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {day.count} votes
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-mono">
                    <span>{timeseries.votesPerDay[0]?.day}</span>
                    <span>{timeseries.votesPerDay[timeseries.votesPerDay.length - 1]?.day}</span>
                </div>
            </Card>

            {/* Active Users + Categories Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Users Per Week - Module 3 */}
                <Card className="rounded-xl p-6 border-[#484E55] bg-[#212020]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-green-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Active Users / Week</h2>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{timeseries.activeUsersPerWeek.length} weeks</span>
                    </div>
                    
                    <div className="space-y-3">
                        {timeseries.activeUsersPerWeek.map((week) => {
                            const maxWeekUsers = Math.max(...timeseries.activeUsersPerWeek.map(w => w.count))
                            const pct = (week.count / maxWeekUsers) * 100
                            return (
                                <div key={week.weekStart} className="flex items-center gap-3">
                                    <span className="text-[10px] text-zinc-500 font-mono w-20 shrink-0">{week.weekStart}</span>
                                    <div className="flex-1 h-6 bg-zinc-900 rounded overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500/60 rounded flex items-center justify-end px-2"
                                            style={{ width: `${pct}%` }}
                                        >
                                            <span className="text-[10px] text-white font-mono font-bold">{week.count.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                {/* Category Distribution - Module 6 */}
                <Card className="rounded-xl p-6 border-[#484E55] bg-[#212020]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-purple-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Categories</h2>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{toplists.categoryDistribution.length} categories</span>
                    </div>
                    
                    <div className="space-y-3">
                        {toplists.categoryDistribution.map((cat, i) => {
                            const maxVotes = toplists.categoryDistribution[0]?.voteCount ?? 1
                            const pct = (cat.voteCount / maxVotes) * 100
                            const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-red-500']
                            return (
                                <div key={cat.name} className="flex items-center gap-3">
                                    <span className="text-xs text-zinc-400 font-mono w-24 truncate" title={cat.name}>{cat.name}</span>
                                    <div className="flex-1 h-5 bg-zinc-900 rounded overflow-hidden">
                                        <div 
                                            className={`h-full ${colors[i % colors.length]}/60 rounded flex items-center justify-end px-2`}
                                            style={{ width: `${pct}%` }}
                                        >
                                            <span className="text-[10px] text-white font-mono">{cat.voteCount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 font-mono w-12 text-right">{cat.brandCount} brands</span>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>

            {/* Top Lists Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 20 Brands - Module 4 */}
                <Card className="rounded-xl p-6 border-[#484E55] bg-[#212020]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top 20 Brands</h2>
                        </div>
                        <Badge variant="outline" className="text-[10px]">All-Time</Badge>
                    </div>
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {toplists.topBrandsAllTime.map((brand, i) => (
                            <div key={brand.brandId} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                <span className="w-6 text-center text-sm font-bold text-zinc-500">#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{brand.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                                        <span>🥇 {brand.gold}</span>
                                        <span>🥈 {brand.silver}</span>
                                        <span>🥉 {brand.bronze}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-yellow-500 font-display">{brand.score.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-600 font-mono">{brand.totalVotes} votes</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top 20 Users - Module 5 */}
                <Card className="rounded-xl p-6 border-[#484E55] bg-[#212020]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-blue-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top 20 Users</h2>
                        </div>
                        <Badge variant="outline" className="text-[10px]">All-Time</Badge>
                    </div>
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {toplists.topUsersAllTime.map((user, i) => (
                            <div key={user.odiumId} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                <span className="w-6 text-center text-sm font-bold text-zinc-500">#{i + 1}</span>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-zinc-500">{user.username.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                                    <p className="text-[10px] text-zinc-500 font-mono">
                                        {user.fid ? `FID ${user.fid}` : `ID ${user.odiumId}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-blue-400 font-display">{user.points.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-600 font-mono">{user.totalVotes} votes</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Footer CTA */}
            <Card className="rounded-xl p-8 border-[#484E55] bg-gradient-to-r from-purple-950/30 to-blue-950/30">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-black text-white font-display uppercase mb-1">Season 2 is Live</h3>
                        <p className="text-zinc-400 text-sm">Onchain voting powered by the BRND Indexer</p>
                    </div>
                    <Button asChild size="lg" className="bg-white text-black hover:bg-zinc-200">
                        <Link href="/dashboard">
                            Go to Season 2 Dashboard →
                        </Link>
                    </Button>
                </div>
            </Card>
        </div>
    )
}
