"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { 
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { TrendingUp, TrendingDown, Users, UserPlus, Repeat, Activity, Clock, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"

interface DashboardData {
    votesPerDay: Array<{ date: string; count: number }>
    topVoters: Array<{ userId: number; username: string; photoUrl: string | null; points: number; voteCount: number }>
    trending: Array<{ id: number; name: string; imageUrl: string | null; thisWeek: number; lastWeek: number; growth: number }>
    categoryDistribution: Array<{ name: string; count: number }>
    newUsers: { thisWeek: number; lastWeek: number; growth: number }
    engagement: { totalUsers: number; activeUsersWeek: number; activeRate: number; avgVotesPerUser: number; retentionRate: number }
    votesByHour: Array<{ hour: number; count: number }>
}

const COLORS = ['#facc15', '#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6']

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl">
                <p className="text-zinc-400 text-xs mb-1">{label}</p>
                <p className="text-white font-bold">{payload[0].value.toLocaleString()}</p>
            </div>
        )
    }
    return null
}

interface DashboardAnalyticsProps {
    initialData?: DashboardData
}

export function DashboardAnalytics({ initialData }: DashboardAnalyticsProps = {}) {
    const [data, setData] = useState<DashboardData | null>(initialData ?? null)
    const [loading, setLoading] = useState(!initialData)
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        // Skip initial fetch if we have initial data from server
        if (initialData) {
            setLoading(false)
            return
        }

        fetch("/api/dashboard/stats")
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text().catch(() => 'No error details')
                    console.error('Dashboard stats API Error Body:', text)
                    throw new Error(`HTTP ${res.status}: ${text}`)
                }
                return res.json()
            })
            .then((json) => {
                if (!json.error) setData(json)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [initialData])

    // Delay chart render to ensure container dimensions are calculated
    useEffect(() => {
        if (!loading && data) {
            const timer = requestAnimationFrame(() => setIsReady(true))
            return () => cancelAnimationFrame(timer)
        }
    }, [loading, data])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="text-center text-zinc-500 py-12">
                Failed to load analytics data
            </div>
        )
    }

    // Formatear datos para el gráfico de área
    const chartData = (data.votesPerDay || []).map(d => ({
        date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        votes: d.count
    }))

    // Formatear horas
    const hourData = (data.votesByHour || []).map(h => ({
        hour: `${h.hour}:00`,
        votes: h.count
    }))
    
    // Safe access to arrays and objects
    const topVoters = data.topVoters || []
    const trending = data.trending || []
    const categoryDistribution = data.categoryDistribution || []
    const newUsers = data.newUsers || { thisWeek: 0, lastWeek: 0, growth: 0 }
    const engagement = data.engagement || { totalUsers: 0, activeUsersWeek: 0, activeRate: 0, avgVotesPerUser: 0, retentionRate: 0 }

    return (
        <div className="space-y-6">
            {/* Engagement Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard
                    icon={UserPlus}
                    label="New Users (7d)"
                    value={newUsers.thisWeek}
                    change={newUsers.growth}
                    color="text-green-400"
                />
                <MetricCard
                    icon={Users}
                    label="Active Rate"
                    value={`${engagement.activeRate}%`}
                    sublabel={`${engagement.activeUsersWeek} of ${engagement.totalUsers}`}
                    color="text-blue-400"
                />
                <MetricCard
                    icon={Activity}
                    label="Avg Podiums/User"
                    value={engagement.avgVotesPerUser}
                    color="text-purple-400"
                />
                <MetricCard
                    icon={Repeat}
                    label="Retention Rate"
                    value={`${engagement.retentionRate}%`}
                    sublabel="week over week"
                    color="text-yellow-400"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Votes Activity Chart */}
                <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                        Podium Activity (30 days)
                    </h3>
                    <div className="h-64">
                        {isReady ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="voteGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#666" 
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis 
                                    stroke="#666" 
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="votes" 
                                    stroke="#facc15" 
                                    strokeWidth={2}
                                    fill="url(#voteGradient)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        ) : <div className="h-full bg-zinc-900/50 rounded-xl animate-pulse" />}
                    </div>
                </Card>

                {/* Peak Hours Chart */}
                <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Peak Podium Hours
                        </h3>
                    </div>
                    <div className="h-64">
                        {isReady ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                            <BarChart data={hourData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis 
                                    dataKey="hour" 
                                    stroke="#666" 
                                    tick={{ fill: '#666', fontSize: 9 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={2}
                                />
                                <YAxis 
                                    stroke="#666" 
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={false} />
                                <Bar dataKey="votes" fill="#a855f7" radius={[4, 4, 0, 0]} activeBar={false} />
                            </BarChart>
                        </ResponsiveContainer>
                        ) : <div className="h-full bg-zinc-900/50 rounded-xl animate-pulse" />}
                    </div>
                </Card>
            </div>

            {/* Second Row: Top Voters, Trending, Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Voters */}
                <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                        Top Users This Week
                    </h3>
                    <div className="space-y-3">
                        {topVoters.slice(0, 5).map((voter, idx) => (
                            <Link 
                                key={voter.userId} 
                                href={`/dashboard/users/${voter.userId}`}
                                className="flex items-center gap-3 hover:bg-zinc-900/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                    idx === 0 ? 'bg-yellow-500 text-black' :
                                    idx === 1 ? 'bg-zinc-400 text-black' :
                                    idx === 2 ? 'bg-amber-700 text-white' :
                                    'bg-zinc-800 text-zinc-400'
                                }`}>
                                    {idx + 1}
                                </span>
                                {voter.photoUrl ? (
                                    <Image
                                        src={voter.photoUrl}
                                        alt={voter.username}
                                        width={28}
                                        height={28}
                                        className="w-7 h-7 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                                        {voter.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{voter.username}</p>
                                </div>
                                <span className="text-sm font-mono text-zinc-400">{voter.voteCount}</span>
                            </Link>
                        ))}
                    </div>
                </Card>

                {/* Trending Brands */}
                <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                        Trending Brands 📈
                    </h3>
                    <div className="space-y-3">
                        {trending.slice(0, 5).map((brand) => (
                            <Link 
                                key={brand.id} 
                                href={`/dashboard/brands/${brand.id}`}
                                className="flex items-center gap-3 hover:bg-zinc-900/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                            >
                                {brand.imageUrl ? (
                                    <Image
                                        src={brand.imageUrl}
                                        alt={brand.name}
                                        width={28}
                                        height={28}
                                        className="rounded-md"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                                        {brand.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{brand.name}</p>
                                    <p className="text-[10px] text-zinc-600">{brand.thisWeek} votes this week</p>
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-mono ${
                                    brand.growth > 0 ? 'text-green-400' : brand.growth < 0 ? 'text-red-400' : 'text-zinc-500'
                                }`}>
                                    {brand.growth > 0 ? <TrendingUp className="w-3 h-3" /> : 
                                     brand.growth < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    {brand.growth > 0 ? '+' : ''}{brand.growth}%
                                </div>
                            </Link>
                        ))}
                    </div>
                </Card>

                {/* Category Distribution */}
                <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                        Brands by Category
                    </h3>
                    <div className="h-48">
                        {isReady ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
                            <PieChart>
                                <Pie
                                    data={categoryDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={2}
                                    dataKey="count"
                                    nameKey="name"
                                >
                                    {categoryDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-zinc-900 border border-zinc-700 p-2 rounded-lg text-xs">
                                                    <p className="text-white font-medium">{payload[0].name}</p>
                                                    <p className="text-zinc-400">{payload[0].value} brands</p>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        ) : <div className="h-full bg-zinc-900/50 rounded-xl animate-pulse" />}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {categoryDistribution.slice(0, 4).map((cat, idx) => (
                            <span key={cat.name} className="flex items-center gap-1 text-[10px] text-zinc-500">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                                {cat.name}
                            </span>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}

function MetricCard({ 
    icon: Icon, 
    label, 
    value, 
    change, 
    sublabel,
    color 
}: { 
    icon: React.ElementType
    label: string
    value: string | number
    change?: number
    sublabel?: string
    color: string
}) {
    return (
        <Card className="rounded-xl p-4 bg-[#212020]/50 border-[#484E55]/50">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-black text-white">{value}</span>
                {change !== undefined && (
                    <span className={`flex items-center gap-0.5 text-xs font-mono ${
                        change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                        {change > 0 ? <TrendingUp className="w-3 h-3" /> : 
                         change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                        {change > 0 ? '+' : ''}{change}%
                    </span>
                )}
            </div>
            {sublabel && (
                <p className="text-[10px] text-zinc-600 mt-1">{sublabel}</p>
            )}
        </Card>
    )
}
