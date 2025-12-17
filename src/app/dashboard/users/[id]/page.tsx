import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { User, Trophy, Award, ArrowLeft, ExternalLink, Zap, Vote, Wallet } from "lucide-react"
import { getIndexerUserByFid } from "@/lib/seasons"
import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = 'force-dynamic'

function parseBrandIds(brandIdsJson: string): number[] {
    try {
        return JSON.parse(brandIdsJson)
    } catch {
        return []
    }
}

export default async function UserDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const fid = Number(id)

    if (isNaN(fid)) {
        notFound()
    }

    const user = await getIndexerUserByFid(fid)

    if (!user) {
        notFound()
    }

    const [recentVotes, powerLevelUps, walletAuthorizations] = await Promise.all([
        prismaIndexer.indexerVote.findMany({
            where: { fid },
            orderBy: { timestamp: 'desc' },
            take: 20,
        }),
        prismaIndexer.indexerBrndPowerLevelUp.findMany({
            where: { fid },
            orderBy: { timestamp: 'desc' },
            take: 10,
        }),
        prismaIndexer.indexerWalletAuthorization.findMany({
            where: { fid },
            orderBy: { timestamp: 'desc' },
        }),
    ])

    const allBrandIds = new Set<number>()
    for (const vote of recentVotes) {
        const brandIds = parseBrandIds(vote.brand_ids)
        brandIds.forEach(id => allBrandIds.add(id))
    }
    const brandsMetadata = await getBrandsMetadata(Array.from(allBrandIds))

    const votesWithBrands = recentVotes.map(vote => {
        const brandIds = parseBrandIds(vote.brand_ids)
        return {
            id: vote.id,
            day: Number(vote.day),
            timestamp: new Date(Number(vote.timestamp) * 1000),
            brands: brandIds.map(id => ({
                id,
                name: brandsMetadata.get(id)?.name ?? "Brand #" + id,
                imageUrl: brandsMetadata.get(id)?.imageUrl ?? null,
            })),
        }
    })

    return (
        <div className="w-full">
            <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-mono text-sm mb-6">
                <ArrowLeft className="w-4 h-4" />
                Back to Users
            </Link>

            <div className="flex items-start gap-6 mb-8">
                {user.photoUrl ? (
                    <Image src={user.photoUrl} width={96} height={96} alt={user.username} className="w-24 h-24 rounded-full object-cover ring-2 ring-border" />
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-border">
                        <User className="h-10 w-10 text-zinc-500" />
                    </div>
                )}
                
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black text-white font-display uppercase">{user.username}</h1>
                        <Badge variant="outline" className="bg-gradient-to-r from-purple-950/50 to-blue-950/50 border-purple-500/30 text-purple-300">Season 2</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-500 font-mono text-sm">
                        <span>FID: {user.fid}</span>
                        <span>•</span>
                        <a href={"https://warpcast.com/" + user.username} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition-colors">
                            Warpcast <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Trophy className="w-5 h-5" />} label="Total Points" value={user.points.toLocaleString()} color="text-yellow-500" />
                <StatCard icon={<Zap className="w-5 h-5" />} label="Power Level" value={user.powerLevel.toString()} color="text-purple-500" />
                <StatCard icon={<Vote className="w-5 h-5" />} label="Total Votes" value={user.totalVotes.toLocaleString()} color="text-blue-500" />
                <StatCard icon={<Award className="w-5 h-5" />} label="Last Vote Day" value={user.lastVoteDay?.toString() ?? "N/A"} color="text-green-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Podiums</h2>
                        <span className="text-xs text-zinc-500 font-mono">{votesWithBrands.length} recent</span>
                    </div>
                    {votesWithBrands.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 font-mono text-sm">No podiums yet.</div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {votesWithBrands.map((vote) => (
                                <div key={vote.id} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                    <div className="text-xs text-zinc-500 font-mono w-20 shrink-0">
                                        <div>Day {vote.day}</div>
                                        <div className="text-zinc-600">{vote.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                                        {vote.brands.map((brand, idx) => (
                                            <Link key={vote.id + "-" + brand.id} href={"/dashboard/brands/" + brand.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors text-xs">
                                                <span>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                                                <span className="text-zinc-400 hover:text-white">{brand.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="space-y-6">
                    <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-4 h-4 text-purple-500" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Power Level History</h2>
                        </div>
                        {powerLevelUps.length === 0 ? (
                            <div className="p-4 text-center text-zinc-600 font-mono text-xs">No level ups recorded</div>
                        ) : (
                            <div className="space-y-2">
                                {powerLevelUps.map((levelUp) => (
                                    <div key={levelUp.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/50">
                                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">Level {levelUp.new_level}</Badge>
                                        <span className="text-[10px] text-zinc-600 font-mono">{new Date(Number(levelUp.timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Wallet className="w-4 h-4 text-blue-500" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Authorized Wallets</h2>
                        </div>
                        {walletAuthorizations.length === 0 ? (
                            <div className="p-4 text-center text-zinc-600 font-mono text-xs">No wallets authorized</div>
                        ) : (
                            <div className="space-y-2">
                                {walletAuthorizations.map((auth) => (
                                    <div key={auth.id} className="p-2 rounded bg-zinc-900/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <a href={"https://basescan.org/address/" + auth.wallet} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-zinc-400 hover:text-white transition-colors truncate max-w-[180px]" title={auth.wallet}>
                                                {auth.wallet.slice(0, 6)}...{auth.wallet.slice(-4)}
                                            </a>
                                            <ExternalLink className="w-3 h-3 text-zinc-600" />
                                        </div>
                                        <span className="text-[10px] text-zinc-600 font-mono">{new Date(Number(auth.timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="p-4 rounded-xl border border-border bg-surface">
            <div className={color + " mb-2"}>{icon}</div>
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold text-white font-display uppercase">{value}</p>
        </div>
    )
}
