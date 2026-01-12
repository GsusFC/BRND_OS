import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"
import type { ReactNode } from "react"
import { Trophy, Award, ArrowLeft, ExternalLink, Zap, Vote, LayoutGrid, List } from "lucide-react"
import { getIndexerUserByFid } from "@/lib/seasons"
import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCompactNumber } from "@/lib/utils"
import { UserAvatar } from "@/components/users/UserAvatar"

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

function parseBrandIds(brandIdsJson: string): [number, number, number] {
    try {
        const parsed: unknown = JSON.parse(brandIdsJson)
        if (!Array.isArray(parsed)) {
            console.warn(`Invalid brand_ids JSON (not an array): ${brandIdsJson}`)
            return [0, 0, 0]
        }

        const parsedArray = parsed as unknown[]
        const ids: number[] = []
        for (const value of parsedArray) {
            const num = Number(value)
            if (Number.isFinite(num)) ids.push(num)
        }

        // Fill with 0 if missing
        while (ids.length < 3) {
            ids.push(0)
        }

        return [ids[0]!, ids[1]!, ids[2]!]
    } catch (e) {
        console.error(`Failed to parse brand_ids: ${brandIdsJson}`, e)
        return [0, 0, 0]
    }
}

interface UserDetailPageProps {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ view?: string; page?: string }>
}

export default async function UserDetailPage({ params, searchParams }: UserDetailPageProps) {
    const { id } = await params
    const fid = Number(id)

    const resolvedSearchParams = await searchParams
    const view = resolvedSearchParams?.view === "cards" ? "cards" : "list"
    const currentPage = Math.max(1, parseInt(resolvedSearchParams?.page || "1", 10))

    if (isNaN(fid)) {
        notFound()
    }

    const user = await getIndexerUserByFid(fid)

    if (!user) {
        notFound()
    }

    const [recentVotes, totalVotesCount, identicalCounts, powerLevelUps] = await Promise.all([
        prismaIndexer.indexerVote.findMany({
            where: { fid },
            orderBy: { timestamp: "desc" },
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prismaIndexer.indexerVote.count({ where: { fid } }),
        prismaIndexer.indexerVote.groupBy({
            by: ["brand_ids"],
            where: { fid },
            _count: { _all: true },
        }),
        prismaIndexer.indexerBrndPowerLevelUp.findMany({
            where: { fid },
            orderBy: { timestamp: "desc" },
        }),
    ])

    const totalPages = Math.max(1, Math.ceil(totalVotesCount / PAGE_SIZE))
    const prevPage = Math.max(1, currentPage - 1)
    const nextPage = Math.min(totalPages, currentPage + 1)

    const identicalCountsByBrandIds = new Map<string, number>(
        identicalCounts.map((row) => [row.brand_ids, row._count._all]),
    )

    const allBrandIds = new Set<number>()
    for (const vote of recentVotes) {
        const [brand1Id, brand2Id, brand3Id] = parseBrandIds(vote.brand_ids)
        allBrandIds.add(brand1Id)
        allBrandIds.add(brand2Id)
        allBrandIds.add(brand3Id)
    }
    const brandsMetadata = await getBrandsMetadata(Array.from(allBrandIds))

    const votesWithBrands = recentVotes.map(vote => {
        const [brand1Id, brand2Id, brand3Id] = parseBrandIds(vote.brand_ids)
        const podiumCount = identicalCountsByBrandIds.get(vote.brand_ids) ?? 1

        const brand1 = brandsMetadata.get(brand1Id)
        const brand2 = brandsMetadata.get(brand2Id)
        const brand3 = brandsMetadata.get(brand3Id)

        return {
            id: vote.id,
            day: Number(vote.day),
            timestamp: new Date(Number(vote.timestamp) * 1000),
            podiumCount,
            brand1: { id: brand1Id, name: brand1?.name ?? `Brand #${brand1Id}`, imageUrl: brand1?.imageUrl ?? null },
            brand2: { id: brand2Id, name: brand2?.name ?? `Brand #${brand2Id}`, imageUrl: brand2?.imageUrl ?? null },
            brand3: { id: brand3Id, name: brand3?.name ?? `Brand #${brand3Id}`, imageUrl: brand3?.imageUrl ?? null },
        }
    })

    return (
        <div className="w-full text-white">
            <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-mono text-sm mb-6">
                <ArrowLeft className="w-4 h-4" />
                Back to Users
            </Link>

            <div className="flex items-start gap-6 mb-8">
                <UserAvatar 
                    src={user.photoUrl} 
                    alt={user.username} 
                    size={96} 
                    className="w-24 h-24" 
                />
                
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black text-white font-display uppercase">{user.username}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-500 font-mono text-sm">
                        <span>FID: {user.fid}</span>
                        <span>•</span>
                        <a href={"https://farcaster.xyz/" + user.username} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition-colors">
                            Farcaster <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Trophy className="w-5 h-5" />} label="Total Points" value={formatCompactNumber(user.points)} color="text-yellow-500" />
                <StatCard icon={<Zap className="w-5 h-5" />} label="Power Level" value={user.powerLevel.toString()} color="text-purple-500" />
                <StatCard icon={<Vote className="w-5 h-5" />} label="Total Votes" value={formatCompactNumber(user.totalVotes)} color="text-blue-500" />
                <StatCard icon={<Award className="w-5 h-5" />} label="Last Vote Day" value={user.lastVoteDay?.toString() ?? "N/A"} color="text-green-500" />
            </div>

            <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50">
                <div className="flex items-center justify-between mb-6">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Podiums</div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono">{totalVotesCount.toLocaleString()} total</span>

                        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                            <Link
                                href={`/dashboard/users/${fid}?view=list&page=1`}
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
                                href={`/dashboard/users/${fid}?view=cards&page=1`}
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

                {votesWithBrands.length === 0 ? (
                    <div className="text-zinc-600 text-xs uppercase tracking-widest text-center py-8">No podiums yet</div>
                ) : (
                    <div className="max-h-[520px] overflow-y-auto pr-2">
                        {view === "list" ? (
                            <div className="space-y-4">
                                {votesWithBrands.map((vote) => (
                                    <div key={vote.id} className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-zinc-300 truncate">Day {vote.day}</div>
                                            <div className="text-[10px] text-zinc-600 font-mono">
                                                {vote.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-1 flex-wrap justify-end">
                                            <Link
                                                href={`/dashboard/brands/${vote.brand1.id}`}
                                                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 hover:bg-zinc-900/60 transition-colors"
                                            >
                                                <span className="text-xs">🥇</span>
                                                <div className="w-5 h-5 rounded bg-black/40 overflow-hidden shrink-0">
                                                    {vote.brand1.imageUrl ? (
                                                        <Image src={vote.brand1.imageUrl} alt={vote.brand1.name} width={20} height={20} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800" />
                                                    )}
                                                </div>
                                                <span className="text-xs text-zinc-300 hover:text-white transition-colors max-w-[140px] truncate">{vote.brand1.name}</span>
                                            </Link>

                                            <Link
                                                href={`/dashboard/brands/${vote.brand2.id}`}
                                                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 hover:bg-zinc-900/60 transition-colors"
                                            >
                                                <span className="text-xs">🥈</span>
                                                <div className="w-5 h-5 rounded bg-black/40 overflow-hidden shrink-0">
                                                    {vote.brand2.imageUrl ? (
                                                        <Image src={vote.brand2.imageUrl} alt={vote.brand2.name} width={20} height={20} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800" />
                                                    )}
                                                </div>
                                                <span className="text-xs text-zinc-300 hover:text-white transition-colors max-w-[140px] truncate">{vote.brand2.name}</span>
                                            </Link>

                                            <Link
                                                href={`/dashboard/brands/${vote.brand3.id}`}
                                                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 hover:bg-zinc-900/60 transition-colors"
                                            >
                                                <span className="text-xs">🥉</span>
                                                <div className="w-5 h-5 rounded bg-black/40 overflow-hidden shrink-0">
                                                    {vote.brand3.imageUrl ? (
                                                        <Image src={vote.brand3.imageUrl} alt={vote.brand3.name} width={20} height={20} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800" />
                                                    )}
                                                </div>
                                                <span className="text-xs text-zinc-300 hover:text-white transition-colors max-w-[140px] truncate">{vote.brand3.name}</span>
                                            </Link>
                                        </div>

                                        {vote.podiumCount > 1 ? (
                                            <Badge variant="outline" className="text-[10px] py-0.5 shrink-0">
                                                x{vote.podiumCount}
                                            </Badge>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                {votesWithBrands.map((vote) => (
                                    <div key={vote.id} className="rounded-2xl border border-zinc-800 bg-black p-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-600 font-mono">
                                                Day {vote.day} • {vote.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </span>
                                            {vote.podiumCount > 1 ? (
                                                <Badge variant="outline" className="text-[10px] py-0.5">
                                                    x{vote.podiumCount}
                                                </Badge>
                                            ) : null}
                                        </div>

                                        <div className="mt-6 flex items-end justify-center gap-4">
                                            <PodiumSpot place="silver" brand={vote.brand2} />
                                            <PodiumSpot place="gold" brand={vote.brand1} />
                                            <PodiumSpot place="bronze" brand={vote.brand3} />
                                        </div>
                                    </div>
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
                            <Link href={`/dashboard/users/${fid}?view=${view}&page=${prevPage}`}>
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
                            <Link href={`/dashboard/users/${fid}?view=${view}&page=${nextPage}`}>
                                Next →
                            </Link>
                        </Button>
                    </div>
                )}
            </Card>

            <Card className="rounded-3xl p-8 bg-[#212020]/50 border-[#484E55]/50 mt-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">BRND Power</div>
                    </div>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                        Level {user.powerLevel}
                    </Badge>
                </div>

                {powerLevelUps.length === 0 ? (
                    <div className="text-zinc-600 text-xs uppercase tracking-widest text-center py-8">No level ups recorded</div>
                ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {powerLevelUps.map((levelUp) => (
                            <div key={levelUp.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                                        Level {levelUp.new_level}
                                    </Badge>
                                    <span className="text-xs text-zinc-500 font-mono">
                                        {new Date(Number(levelUp.timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>
                                <a
                                    href={`https://basescan.org/tx/${levelUp.transaction_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-zinc-600 hover:text-white transition-colors font-mono flex items-center gap-1"
                                >
                                    {levelUp.transaction_hash.slice(0, 6)}...{levelUp.transaction_hash.slice(-4)}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}

function StatCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="p-4 rounded-xl border border-border bg-surface">
            <div className={color + " mb-2"}>{icon}</div>
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold text-white font-display uppercase">{value}</p>
        </div>
    )
}

function PodiumSpot({
    place,
    brand,
}: {
    place: "gold" | "silver" | "bronze"
    brand: { id: number; name: string; imageUrl: string | null }
}) {
    const rank = place === "gold" ? 1 : place === "silver" ? 2 : 3
    const height = place === "gold" ? "h-[200px]" : place === "silver" ? "h-[185px]" : "h-[170px]"

    return (
        <Link href={`/dashboard/brands/${brand.id}`} className="flex flex-col items-center group">
            <div className="w-[86px] rounded-t-[16px] rounded-b-none p-[1px] bg-gradient-to-b from-[#171718] to-black">
                <div className={clsx("w-full rounded-t-[15px] rounded-b-none bg-black px-1 pt-1 pb-2 flex flex-col items-center", height)}>
                    <div className="w-[78px] h-[78px] rounded-[11px] overflow-hidden flex items-center justify-center">
                        {brand.imageUrl ? (
                            <Image src={brand.imageUrl} alt={brand.name} width={78} height={78} className="w-full h-full object-cover rounded-[11px]" />
                        ) : (
                            <div className="w-full h-full bg-zinc-800 rounded-lg" />
                        )}
                    </div>
                    <div className="text-2xl font-display bg-gradient-to-b from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent mt-auto">
                        {rank}
                    </div>
                </div>
            </div>
            <div className="mt-1.5 text-center">
                <div className="text-[10px] font-semibold text-white group-hover:text-zinc-300 transition-colors truncate max-w-[70px]" title={brand.name}>
                    {brand.name}
                </div>
            </div>
        </Link>
    )
}
