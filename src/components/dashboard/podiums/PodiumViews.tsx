"use client"

import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"

export type PodiumBrand = {
    id: number
    name: string
    imageUrl?: string | null
}

export type PodiumEntry = {
    id: number | string
    day: number
    dateLabel: string
    userPodiumCount: number
    globalPodiumCount: number
    brand1: PodiumBrand
    brand2: PodiumBrand
    brand3: PodiumBrand
}

export function PodiumList({ votes }: { votes: PodiumEntry[] }) {
    return (
        <div className="space-y-4">
            {votes.map((vote) => (
                <div key={vote.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-300 truncate">Day {vote.day}</div>
                        <div className="text-[10px] text-zinc-600 font-mono">
                            {vote.dateLabel}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-1 flex-wrap justify-end">
                        <PodiumListLink brand={vote.brand1} medal="🥇" />
                        <PodiumListLink brand={vote.brand2} medal="🥈" />
                        <PodiumListLink brand={vote.brand3} medal="🥉" />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {vote.userPodiumCount > 1 ? (
                            <span className="text-[9px] text-zinc-400 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                                x{vote.userPodiumCount}
                            </span>
                        ) : null}
                        {vote.globalPodiumCount > 1 ? (
                            <span className="text-[9px] text-yellow-500 font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded tabular-nums">
                                {vote.globalPodiumCount}x identical
                            </span>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function PodiumGrid({ votes }: { votes: PodiumEntry[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {votes.map((vote) => (
                <div key={vote.id} className="rounded-2xl border border-zinc-800 bg-black p-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-600 font-mono">
                            Day {vote.day} • {vote.dateLabel}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {vote.userPodiumCount > 1 ? (
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                                    x{vote.userPodiumCount}
                                </span>
                            ) : null}
                            {vote.globalPodiumCount > 1 ? (
                                <span className="text-[9px] text-yellow-500 font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded tabular-nums">
                                    {vote.globalPodiumCount}x identical
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-6 flex items-end justify-center gap-4">
                        <PodiumSpot place="silver" brand={vote.brand2} />
                        <PodiumSpot place="gold" brand={vote.brand1} />
                        <PodiumSpot place="bronze" brand={vote.brand3} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function PodiumListLink({ brand, medal }: { brand: PodiumBrand; medal: string }) {
    return (
        <Link
            href={`/dashboard/brands/${brand.id}`}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 hover:bg-zinc-900/60 transition-colors"
        >
            <span className="text-xs">{medal}</span>
            <div className="w-5 h-5 rounded bg-black/40 overflow-hidden shrink-0">
                {brand.imageUrl ? (
                    <Image src={brand.imageUrl} alt={brand.name} width={20} height={20} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full bg-zinc-800" />
                )}
            </div>
            <span className="text-xs text-zinc-300 hover:text-white transition-colors max-w-[140px] truncate">
                {brand.name}
            </span>
        </Link>
    )
}

function PodiumSpot({
    place,
    brand,
}: {
    place: "gold" | "silver" | "bronze"
    brand: PodiumBrand
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
                <div className="text-[10px] font-semibold text-white group-hover:text-zinc-300 transition-colors truncate max-w-20" title={brand.name}>
                    {brand.name}
                </div>
            </div>
        </Link>
    )
}
