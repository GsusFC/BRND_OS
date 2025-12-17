import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ArrowLeft, Globe, ExternalLink, ArrowUpRight, MessageSquare, Heart, Repeat2, MessageCircle } from "lucide-react"
import Link from "next/link"
import { DynamicChartWrapper } from "@/components/intelligence/DynamicChartWrapper"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchCastsByFid, fetchChannelCasts } from "@/lib/neynar"
import { fetchChannelByIdCached, fetchUserByUsernameCached } from "@/lib/farcaster-profile-cache"

export const dynamic = 'force-dynamic'

const BASE_PATH = "/dashboard/season-1"

interface BrandPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function Season1BrandPage({ params }: BrandPageProps) {
    const { id } = await params
    const brandId = parseInt(id)

    if (isNaN(brandId)) notFound()

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

    const [goldVotes, silverVotes, bronzeVotes] = await Promise.all([
        prisma.userBrandVote.count({ where: { brand1Id: brandId } }),
        prisma.userBrandVote.count({ where: { brand2Id: brandId } }),
        prisma.userBrandVote.count({ where: { brand3Id: brandId } })
    ])

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

    let neynarData = null
    let recentCasts: any[] = []
    
    const channelId = brand.channel || (brand.profile ? brand.profile.replace('@', '').split('.')[0].trim() : null)
    
    if (channelId) {
        try {
            const [channelResult, userResult] = await Promise.all([
                fetchChannelByIdCached(channelId),
                fetchUserByUsernameCached(channelId)
            ])
            
            if ('success' in channelResult && channelResult.success) {
                neynarData = channelResult.data
            }
            
            if ('success' in userResult && userResult.success) {
                const castsResult = await fetchCastsByFid(userResult.data.fid, 5)
                if ('success' in castsResult && castsResult.success) {
                    recentCasts = castsResult.data
                }
            } else if (neynarData?.lead?.fid) {
                const castsResult = await fetchCastsByFid(neynarData.lead.fid, 5)
                if ('success' in castsResult && castsResult.success) {
                    recentCasts = castsResult.data
                }
            }
            
            if (recentCasts.length === 0) {
                const castsResult = await fetchChannelCasts(channelId, 5)
                if ('success' in castsResult && castsResult.success) {
                    recentCasts = castsResult.data
                }
            }
        } catch (error) {
            console.error('[Neynar] Fetch error:', error)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
            <Button asChild variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-white text-zinc-500 uppercase tracking-widest font-bold text-sm">
                <Link href={`${BASE_PATH}/brands`}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Brands
                </Link>
            </Button>

            <div className="flex flex-col md:flex-row items-start justify-between mb-12 gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl md:text-6xl font-black font-display text-white uppercase">
                            {brand.name}
                        </h1>
                        <Badge variant="outline" className="text-zinc-500">Season 1</Badge>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square relative overflow-hidden group">
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                        <ArrowUpRight className="w-3 h-3" />
                        Trending
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Monthly Score</div>
                    <div className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                        {brand.score?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Followers</div>
                        {neynarData && (
                            <div className="flex items-center gap-1 bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                Live
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">Farcaster</div>
                        <div className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                            {neynarData 
                                ? (neynarData.followerCount >= 1000 
                                    ? (neynarData.followerCount / 1000).toFixed(1) + 'K' 
                                    : neynarData.followerCount)
                                : (brand.followerCount 
                                    ? (brand.followerCount / 1000).toFixed(1) + 'K' 
                                    : '0')
                            }
                        </div>
                    </div>
                </div>

                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Ranking</div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">Global</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl md:text-3xl font-black font-display text-white uppercase group-hover:scale-105 transition-transform duration-300">
                                {brand.ranking || "-"}
                            </span>
                            <span className="text-lg text-zinc-600 font-bold">/100</span>
                        </div>
                    </div>
                </div>

                <div className="card-gradient rounded-3xl p-6 flex flex-col justify-between aspect-square group">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Category</div>
                    <div className="text-xl md:text-2xl font-black font-display text-white uppercase break-words leading-tight group-hover:scale-105 transition-transform duration-300">
                        {brand.category?.name || "General"}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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

                <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6">Latest Podiums</div>
                    <div className="space-y-4">
                        {topVoters.map((vote: any) => (
                            <Link key={vote.id} href={`${BASE_PATH}/users/${vote.user.id}`} className="flex items-center justify-between group">
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
                            </Link>
                        ))}
                        {topVoters.length === 0 && (
                            <div className="text-zinc-600 text-xs uppercase tracking-widest text-center py-8">No recent voters</div>
                        )}
                    </div>
                </Card>
            </div>

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
                        {recentCasts.map((cast: any) => (
                            <div key={cast.hash} className="p-4 rounded-xl bg-black/50 border border-zinc-900 hover:border-zinc-700 transition-colors">
                                <div className="flex items-start gap-3">
                                    <img 
                                        src={cast.author.pfpUrl} 
                                        alt={cast.author.username}
                                        className="w-8 h-8 rounded-full object-cover"
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
