import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { User, Calendar, Trophy, Award, ArrowLeft, ExternalLink, LayoutGrid, List } from "lucide-react"
import clsx from "clsx"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export const dynamic = 'force-dynamic'

interface VoteWithBrands {
    id: string
    date: Date
    shared: number
    brand1Id: number | null
    brand2Id: number | null
    brand3Id: number | null
    brand1: { id: number; name: string; imageUrl: string | null } | null
    brand2: { id: number; name: string; imageUrl: string | null } | null
    brand3: { id: number; name: string; imageUrl: string | null } | null
}

interface UserWithVotes {
    id: number
    fid: number
    username: string
    photoUrl: string | null
    points: number
    role: string
    createdAt: Date
    updatedAt: Date
    votes: VoteWithBrands[]
    _count: {
        votes: number
    }
}

export default async function UserDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ view?: string; page?: string }>
}) {
    const { id } = await params
    const resolvedSearchParams = await searchParams
    const userId = Number(id)
    const view = resolvedSearchParams?.view === "cards" ? "cards" : "list"
    const currentPage = Math.max(1, parseInt(resolvedSearchParams?.page || "1", 10))
    const pageSize = 50

    if (isNaN(userId)) {
        notFound()
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            votes: {
                orderBy: { date: "desc" },
                skip: (currentPage - 1) * pageSize,
                take: pageSize,
                include: {
                    brand1: { select: { id: true, name: true, imageUrl: true } },
                    brand2: { select: { id: true, name: true, imageUrl: true } },
                    brand3: { select: { id: true, name: true, imageUrl: true } },
                },
            },
            _count: {
                select: { votes: true },
            },
        },
    }) as UserWithVotes | null

    if (!user) {
        notFound()
    }

    // Calcular podiums idénticos para cada voto
    const votesWithCounts = await Promise.all(
        user.votes.map(async (vote) => {
            let podiumCount = 0
            if (vote.brand1Id && vote.brand2Id && vote.brand3Id) {
                podiumCount = await prisma.userBrandVote.count({
                    where: {
                        brand1Id: vote.brand1Id,
                        brand2Id: vote.brand2Id,
                        brand3Id: vote.brand3Id,
                    }
                })
            }
            return { ...vote, podiumCount }
        })
    )

    const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })

    const daysSinceJoined = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )

    return (
        <div className="w-full">
            {/* Back button */}
            <Link 
                href="/dashboard/users" 
                className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-mono text-sm mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Users
            </Link>

            {/* Header */}
            <div className="flex items-start gap-6 mb-8">
                {user.photoUrl ? (
                    <Image
                        src={user.photoUrl}
                        width={96}
                        height={96}
                        alt={user.username}
                        className="w-24 h-24 rounded-full object-cover ring-2 ring-border"
                    />
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-border">
                        <User className="h-10 w-10 text-zinc-500" />
                    </div>
                )}
                
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black text-white font-display uppercase">
                            {user.username}
                        </h1>
                        {user.role === 'admin' && (
                            <span className="inline-flex items-center rounded-full bg-purple-950/20 px-3 py-1 text-xs font-medium text-purple-400 font-mono">
                                ADMIN
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-zinc-500 font-mono text-sm">
                        <span>FID: {user.fid}</span>
                        <span>•</span>
                        <span>ID: {user.id}</span>
                        <span>•</span>
                        <a 
                            href={`https://warpcast.com/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-white transition-colors"
                        >
                            Warpcast <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={<Trophy className="w-5 h-5" />}
                    label="Total Points"
                    value={user.points.toLocaleString()}
                    color="text-yellow-500"
                />
                <StatCard
                    icon={<Award className="w-5 h-5" />}
                    label="Total Podiums"
                    value={user._count.votes.toLocaleString()}
                    color="text-blue-500"
/>
                <StatCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Joined"
                    value={joinedDate}
                    subvalue={`${daysSinceJoined} days ago`}
                    color="text-green-500"
                />
                <StatCard
                    icon={<User className="w-5 h-5" />}
                    label="Role"
                    value={user.role.toUpperCase()}
                    color="text-purple-500"
                />
            </div>

            {/* Recent Votes */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white font-display uppercase">
                        Recent Podiums
                    </h2>
                    
                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                        <Link
                            href={`/dashboard/users/${user.id}?view=list`}
                            className={clsx(
                                "p-2 rounded-md transition-colors",
                                view === "list"
                                    ? "bg-white text-black"
                                    : "text-zinc-500 hover:text-white"
                            )}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </Link>
                        <Link
                            href={`/dashboard/users/${user.id}?view=cards`}
                            className={clsx(
                                "p-2 rounded-md transition-colors",
                                view === "cards"
                                    ? "bg-white text-black"
                                    : "text-zinc-500 hover:text-white"
                            )}
                            title="Cards view"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
                
                {votesWithCounts.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-border bg-surface">
                        <p className="text-zinc-500 font-mono text-sm">No podiums yet.</p>
                    </div>
                ) : view === "cards" ? (
                    /* Cards View - Podium Style */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                        {votesWithCounts.map((vote) => (
                            <div 
                                key={vote.id}
                                className="card-gradient rounded-xl p-4 border border-transparent hover:border-zinc-700 transition-all"
                            >
                                {/* Header con fecha y badges */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs text-zinc-500 font-mono">
                                        {new Date(vote.date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {vote.shared === 1 && (
                                            <span className="text-[9px] text-green-500 font-mono uppercase bg-green-500/10 px-1.5 py-0.5 rounded">
                                                Shared
                                            </span>
                                        )}
                                        {vote.podiumCount > 1 && (
                                            <span className="text-[9px] text-yellow-500 font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                                {vote.podiumCount}x identical
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Podium Visual - Olympic Style */}
                                <div className="flex items-end justify-center gap-2 pt-2">
                                    {/* 2nd Place - Silver (Left) */}
                                    {vote.brand2 && (
                                        <Link
                                            href={`/dashboard/brands/${vote.brand2.id}`}
                                            className="group"
                                        >
                                            <div className="w-[72px] h-[180px] rounded-t-[10px] rounded-b-none pt-[2px] px-[2px] pb-2 flex flex-col items-center transition-all" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), #0a0a0b)', padding: '1px' }}>
                                                <div className="w-full h-full rounded-t-[9px] rounded-b-none flex flex-col items-center pt-[1px] px-[1px] pb-2" style={{ backgroundColor: '#0a0a0b' }}>
                                                    <div className="w-full aspect-square rounded-[8px] overflow-hidden shrink-0">
                                                        {vote.brand2.imageUrl ? (
                                                            <Image
                                                                src={vote.brand2.imageUrl}
                                                                width={64}
                                                                height={64}
                                                                alt={vote.brand2.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-lg text-zinc-600">
                                                                {vote.brand2.name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[40px] font-black font-display uppercase bg-gradient-to-b from-pink-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent mt-auto" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>
                                                        2
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors font-medium text-center truncate w-full">
                                                        {vote.brand2.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                    
                                    {/* 1st Place - Gold (Center) - Tallest */}
                                    {vote.brand1 && (
                                        <Link
                                            href={`/dashboard/brands/${vote.brand1.id}`}
                                            className="group"
                                        >
                                            <div className="w-[72px] h-[210px] rounded-t-[10px] rounded-b-none pt-[2px] px-[2px] pb-2 flex flex-col items-center transition-all" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), #0a0a0b)', padding: '1px' }}>
                                                <div className="w-full h-full rounded-t-[9px] rounded-b-none flex flex-col items-center pt-[1px] px-[1px] pb-2" style={{ backgroundColor: '#0a0a0b' }}>
                                                    <div className="w-full aspect-square rounded-[8px] overflow-hidden shrink-0">
                                                        {vote.brand1.imageUrl ? (
                                                            <Image
                                                                src={vote.brand1.imageUrl}
                                                                width={64}
                                                                height={64}
                                                                alt={vote.brand1.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xl text-zinc-600">
                                                                {vote.brand1.name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[40px] font-black font-display uppercase bg-gradient-to-b from-pink-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent mt-auto" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>
                                                        1
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 group-hover:text-white transition-colors font-medium text-center truncate w-full">
                                                        {vote.brand1.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                    
                                    {/* 3rd Place - Bronze (Right) - Shortest */}
                                    {vote.brand3 && (
                                        <Link
                                            href={`/dashboard/brands/${vote.brand3.id}`}
                                            className="group"
                                        >
                                            <div className="w-[72px] h-[160px] rounded-t-[10px] rounded-b-none pt-[2px] px-[2px] pb-2 flex flex-col items-center transition-all" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), #0a0a0b)', padding: '1px' }}>
                                                <div className="w-full h-full rounded-t-[9px] rounded-b-none flex flex-col items-center pt-[1px] px-[1px] pb-2" style={{ backgroundColor: '#0a0a0b' }}>
                                                    <div className="w-full aspect-square rounded-[8px] overflow-hidden shrink-0">
                                                        {vote.brand3.imageUrl ? (
                                                            <Image
                                                                src={vote.brand3.imageUrl}
                                                                width={64}
                                                                height={64}
                                                                alt={vote.brand3.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-lg text-zinc-600">
                                                                {vote.brand3.name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[40px] font-black font-display uppercase bg-gradient-to-b from-pink-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent mt-auto" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>
                                                        3
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors font-medium text-center truncate w-full">
                                                        {vote.brand3.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                        {votesWithCounts.map((vote) => (
                            <div 
                                key={vote.id}
                                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors"
                            >
                                <div className="text-sm text-zinc-500 font-mono w-24 shrink-0">
                                    {new Date(vote.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </div>
                                
                                <div className="flex items-center gap-2 flex-1">
                                    {[vote.brand1, vote.brand2, vote.brand3].map((brand, idx) => (
                                        brand && (
                                            <Link
                                                key={brand.id}
                                                href={`/dashboard/brands/${brand.id}`}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors group"
                                            >
                                                <span className="text-[10px] text-zinc-600 font-mono">
                                                    #{idx + 1}
                                                </span>
                                                {brand.imageUrl ? (
                                                    <Image
                                                        src={brand.imageUrl}
                                                        width={20}
                                                        height={20}
                                                        alt={brand.name}
                                                        className="rounded"
                                                    />
                                                ) : (
                                                    <div className="w-5 h-5 rounded bg-zinc-700" />
                                                )}
                                                <span className="text-sm text-zinc-400 group-hover:text-white transition-colors font-medium">
                                                    {brand.name}
                                                </span>
                                            </Link>
                                        )
                                    ))}
                                </div>

                                {vote.podiumCount > 1 && (
                                    <span className="text-[9px] text-yellow-500 font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                        {vote.podiumCount}x
                                    </span>
                                )}

                                {vote.shared === 1 && (
                                    <span className="text-[10px] text-green-500 font-mono uppercase">
                                        Shared
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {user._count.votes > pageSize && (
                    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-zinc-800">
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            disabled={currentPage <= 1}
                            className={currentPage <= 1 ? "opacity-50 pointer-events-none" : ""}
                        >
                            <Link href={`/dashboard/users/${user.id}?view=${view}&page=${currentPage - 1}`}>
                                ← Prev
                            </Link>
                        </Button>
                        
                        <span className="text-xs text-zinc-500 font-mono px-3">
                            Page {currentPage} of {Math.ceil(user._count.votes / pageSize)}
                        </span>
                        
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            disabled={currentPage >= Math.ceil(user._count.votes / pageSize)}
                            className={currentPage >= Math.ceil(user._count.votes / pageSize) ? "opacity-50 pointer-events-none" : ""}
                        >
                            <Link href={`/dashboard/users/${user.id}?view=${view}&page=${currentPage + 1}`}>
                                Next →
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatCard({ 
    icon, 
    label, 
    value, 
    subvalue,
    color 
}: { 
    icon: React.ReactNode
    label: string
    value: string
    subvalue?: string
    color: string
}) {
    return (
        <div className="p-4 rounded-xl border border-border bg-surface">
            <div className={`${color} mb-2`}>{icon}</div>
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mb-1">
                {label}
            </p>
            <p className="text-xl font-bold text-white font-display uppercase">
                {value}
            </p>
            {subvalue && (
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {subvalue}
                </p>
            )}
        </div>
    )
}
