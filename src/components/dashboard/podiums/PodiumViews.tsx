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

export function PodiumListLink({ brand, medal }: { brand: PodiumBrand; medal: string }) {
    const isSvgRemote =
        typeof brand.imageUrl === "string" &&
        (brand.imageUrl.toLowerCase().endsWith(".svg") ||
            (brand.imageUrl.includes("imagedelivery.net") && brand.imageUrl.includes("/original")))
    return (
        <Link
            href={`/dashboard/brands/${brand.id}`}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 hover:bg-zinc-900/60 transition-colors"
        >
            <span className="text-xs">{medal}</span>
            <div className="w-5 h-5 rounded bg-black/40 overflow-hidden shrink-0">
                {brand.imageUrl ? (
                    isSvgRemote ? (
                        <img
                            src={brand.imageUrl}
                            alt={brand.name}
                            width={20}
                            height={20}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <Image src={brand.imageUrl} alt={brand.name} width={20} height={20} className="w-full h-full object-contain" />
                    )
                ) : (
                    <div className="w-full h-full rounded bg-gradient-to-b from-zinc-700 to-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-200">
                        {brand.name?.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <span className="text-xs text-zinc-300 hover:text-white transition-colors max-w-[140px] truncate">
                {brand.name}
            </span>
        </Link>
    )
}

export function PodiumSpot({

    place,

    brand,

}: {

    place: "gold" | "silver" | "bronze"

    brand: PodiumBrand

}) {

    const rank = place === "gold" ? 1 : place === "silver" ? 2 : 3

    // Tall monolith heights

    const height = place === "gold" ? "h-[280px]" : place === "silver" ? "h-[250px]" : "h-[220px]"

    

    // Rank specific styles for the number gradient

    const rankColors = {

        gold: "from-yellow-200 via-yellow-400 to-yellow-700",

        silver: "from-zinc-100 via-zinc-300 to-zinc-500",

        bronze: "from-amber-400 via-amber-600 to-amber-900"

    }



    const isSvgRemote =

        typeof brand.imageUrl === "string" &&

        (brand.imageUrl.toLowerCase().endsWith(".svg") ||

            (brand.imageUrl.includes("imagedelivery.net") && brand.imageUrl.includes("/original")))



    return (

        <Link href={`/dashboard/brands/${brand.id}`} className="flex flex-col items-center group">

            {/* The Monolith Container */}

            <div className={clsx(

                "w-[110px] rounded-[24px] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-2 flex flex-col items-center transition-all duration-300 group-hover:border-white/30 group-hover:scale-[1.02] shadow-2xl",

                height

            )}>

                {/* Brand Image - Top Square */}

                <div className="w-full aspect-square rounded-[18px] overflow-hidden bg-black/40 relative ring-1 ring-white/5">

                    {brand.imageUrl ? (

                        isSvgRemote ? (

                            <img

                                src={brand.imageUrl}

                                alt={brand.name}

                                className="w-full h-full object-cover p-1"

                            />

                        ) : (

                            <Image 

                                src={brand.imageUrl} 

                                alt={brand.name} 

                                width={100} 

                                height={100} 

                                className="w-full h-full object-cover p-1" 

                            />

                        )

                    ) : (

                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-800">

                            {brand.name?.charAt(0).toUpperCase()}

                        </div>

                    )}

                </div>



                {/* Rank Number - Large and Centered in the middle area */}

                <div className="flex-1 flex items-center justify-center">

                    <span className={clsx(

                        "text-6xl font-black font-display italic tracking-tighter bg-gradient-to-b bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]",

                        rankColors[place]

                    )}>

                        {rank}

                    </span>

                </div>



                {/* Footer info inside the monolith */}

                <div className="w-full text-center pb-2">

                    <div className="text-[11px] font-bold text-white truncate px-1" title={brand.name}>

                        {brand.name}

                    </div>

                    <div className="text-[9px] font-mono text-zinc-500 mt-0.5 uppercase tracking-tight">

                        ID #{brand.id}

                    </div>

                </div>

            </div>

        </Link>

    )

}

