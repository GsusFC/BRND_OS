import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ArrowLeft, Globe, ExternalLink, Trophy, Users, TrendingUp, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { DynamicChartWrapper } from "@/components/intelligence/DynamicChartWrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const dynamic = 'force-dynamic'

interface BrandPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function BrandPage({ params }: BrandPageProps) {
    const { id } = await params
    const brandId = parseInt(id)

    if (isNaN(brandId)) notFound()

    // 1. Fetch Brand Details
    const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: {
            category: true,
            tags: {
                include: {
                    tag: true
                }
            }
        }
    })

    if (!brand) notFound()

    // 2. Fetch Vote History (Last 30 days)
    const votesHistory = await prisma.$queryRaw`
        SELECT 
            DATE(date) as date, 
            COUNT(*) as votes
        FROM user_brand_votes
        WHERE (brand1Id = ${brandId} OR brand2Id = ${brandId} OR brand3Id = ${brandId})
        AND date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(date)
        ORDER BY date ASC
    ` as any[]

    const chartData = votesHistory.map((v: any) => ({
        date: new Date(v.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
        votes: Number(v.votes)
    }))

    // 3. Fetch Podium Stats
    const [goldVotes, silverVotes, bronzeVotes] = await Promise.all([
        prisma.userBrandVote.count({ where: { brand1Id: brandId } }),
        prisma.userBrandVote.count({ where: { brand2Id: brandId } }),
        prisma.userBrandVote.count({ where: { brand3Id: brandId } })
    ])

    // 4. Fetch Top Voters
    const topVoters = await prisma.userBrandVote.findMany({
        where: {
            OR: [
                { brand1Id: brandId },
                { brand2Id: brandId },
                { brand3Id: brandId }
            ]
        },
        take: 5,
        orderBy: { date: 'desc' },
        include: {
            user: true
        }
    })

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
            <div className="flex flex-col md:flex-row items-start justify-between mb-12 gap-8">
                <div>
                    <h1 className="text-4xl md:text-6xl font-black mb-4 font-display text-white uppercase">
                        {brand.name}
                    </h1>
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

                {/* Brand Logo/Avatar */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[22%] bg-[#212020] border border-[#484E55] overflow-hidden shadow-2xl">
                    {brand.imageUrl ? (
                        <img src={brand.imageUrl} alt={brand.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-500 font-display">
                            {brand.name.charAt(0)}
                        </div>
                    )}
                </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

                {/* SCORE CARD */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square relative overflow-hidden group">
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                        <ArrowUpRight className="w-3 h-3" />
                        Trending
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Monthly Score</div>
                    <div className="text-3xl md:text-4xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                        {brand.score?.toLocaleString() || 0}
                    </div>
                </div>

                {/* FOLLOWERS CARD */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Followers</div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">All Time</div>
                        <div className="text-3xl md:text-4xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                            {brand.followerCount ? (brand.followerCount / 1000).toFixed(1) + 'K' : '0'}
                        </div>
                    </div>
                </div>

                {/* RANKING CARD */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Ranking</div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">Global</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl md:text-4xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                                {brand.ranking || "-"}
                            </span>
                            <span className="text-lg text-zinc-600 font-bold">/100</span>
                        </div>
                    </div>
                </div>

                {/* CATEGORY CARD */}
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Category</div>
                    <div className="text-2xl md:text-3xl font-black font-display text-white uppercase break-words leading-tight group-hover:scale-105 transition-transform duration-300">
                        {brand.category?.name || "General"}
                    </div>
                </div>
            </div>

            {/* SECOND ROW: DESCRIPTION & CHART */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

                {/* DESCRIPTION CARD */}
                <Card className="rounded-3xl p-8 lg:col-span-1 flex flex-col bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Description</div>
                        <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
                    </div>
                    <h3 className="text-xl font-bold mb-4 text-white leading-tight">
                        {brand.name} is building the future.
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed flex-1">
                        {brand.description || "No description available for this brand."}
                    </p>

                    {/* Tags */}
                    {brand.tags && brand.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-zinc-900">
                            {brand.tags.map((t: any) => (
                                <Badge key={t.tag.id} variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">
                                    {t.tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Card>

                {/* CHART CARD */}
                <Card className="rounded-3xl p-8 lg:col-span-2 min-h-[300px] flex flex-col bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Activity</div>
                        <div className="flex gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-[250px]">
                        {chartData.length > 0 ? (
                            <DynamicChartWrapper
                                type="line"
                                data={chartData}
                                xAxisKey="date"
                                dataKey="votes"
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                                No recent activity
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* THIRD ROW: PODIUM & VOTERS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* PODIUM CARD */}
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8">Podium Stats</div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥇</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{goldVotes}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Gold</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥈</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{silverVotes}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Silver</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-black border border-zinc-900">
                            <div className="text-2xl mb-2">🥉</div>
                            <div className="text-2xl font-black font-display text-white uppercase">{bronzeVotes}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Bronze</div>
                        </div>
                    </div>
                </Card>

                {/* LATEST PODIUMS */}
                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6">Latest Podiums</div>
                    <div className="space-y-4">
                        {topVoters.map((vote: any) => (
                            <div key={vote.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-surface overflow-hidden">
                                        {vote.user.photoUrl ? (
                                            <img src={vote.user.photoUrl} alt={vote.user.username} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                        ) : (
                                            <div className="w-full h-full bg-surface" />
                                        )}
                                    </div>
                                    <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">
                                        {vote.user.username}
                                    </span>
                                </div>
                                <Badge variant="outline" className="text-[10px] py-0.5">
                                    {vote.brand1Id === brandId ? '🥇 Gold' : vote.brand2Id === brandId ? '🥈 Silver' : '🥉 Bronze'}
                                </Badge>
                            </div>
                        ))}
                        {topVoters.length === 0 && (
                            <div className="text-zinc-600 text-xs uppercase tracking-widest text-center py-8">No recent voters</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
