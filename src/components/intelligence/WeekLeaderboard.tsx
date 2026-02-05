"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"


interface LeaderboardEntry {
    rank: number
    name: string
    imageUrl?: string
    channel?: string
    score: number
    gold: number
    silver: number
    bronze: number
    totalPodiums: number
}

interface WeekLeaderboardProps {
    data: Record<string, unknown>[]
    title?: string
    allowExport?: boolean
}


export function WeekLeaderboard({ data, title, allowExport = true }: WeekLeaderboardProps) {
    const exportRef = useRef<HTMLDivElement>(null)
    const [exporting, setExporting] = useState(false)

    if (!data || data.length === 0) return null

    // Transform data — handle both camelCase and lowercase (PostgreSQL normalizes to lowercase)
    const entries: LeaderboardEntry[] = data.map((row, index) => {
        const gold = Number(row.gold || row.Gold || row.gold_count || row.brand1_votes || row.first_place || 0)
        const silver = Number(row.silver || row.Silver || row.silver_count || row.brand2_votes || row.second_place || 0)
        const bronze = Number(row.bronze || row.Bronze || row.bronze_count || row.brand3_votes || row.third_place || 0)
        const totalPodiums = Number(
            row.total_podiums || row.totalPodiums || row.totalvotes || row.totalVotes ||
            row.total_votes || row.TotalVotes || 0
        )

        return {
            rank: index + 1,
            name: String(row.name || row.brand_name || row.Brand || "Unknown"),
            imageUrl: (row.imageUrl || row.image_url || row.imageurl) as string | undefined,
            channel: row.channel as string | undefined,
            score: Number(row.score || row.Score || row.scoreWeek || row.score_week || row.scoreweek || 0),
            gold,
            silver,
            bronze,
            totalPodiums: totalPodiums || (gold + silver + bronze),
        }
    })

    const getRankBadge = (rank: number, isExport = false) => {
        const baseClasses = `w-7 h-7 rounded-full flex items-center justify-center font-black text-xs`
        if (isExport) {
            switch (rank) {
                case 1:
                    return `${baseClasses} bg-gradient-to-br from-yellow-400 to-yellow-500 text-white`
                case 2:
                    return `${baseClasses} bg-gradient-to-br from-gray-300 to-gray-400 text-white`
                case 3:
                    return `${baseClasses} bg-gradient-to-br from-amber-500 to-amber-600 text-white`
                default:
                    return `${baseClasses} bg-gray-100 text-gray-600 border border-gray-200`
            }
        }
        switch (rank) {
            case 1:
                return `${baseClasses} bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-md shadow-yellow-500/20`
            case 2:
                return `${baseClasses} bg-gradient-to-br from-zinc-300 to-zinc-500 text-black shadow-md shadow-zinc-400/20`
            case 3:
                return `${baseClasses} bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-md shadow-amber-700/20`
            default:
                return `${baseClasses} bg-zinc-800 text-zinc-500 border border-zinc-700/50`
        }
    }

    const handleExportPNG = async () => {
        setExporting(true)

        try {
            const response = await fetch('/api/leaderboard/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entries: entries.slice(0, 10),
                    title: title
                }),
            })

            if (!response.ok) {
                const text = await response.text().catch(() => '')
                throw new Error(text || `Export failed (HTTP ${response.status})`)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            const now = new Date()
            const date = now.toISOString().split("T")[0]
            const time = now.toTimeString().slice(0, 8).replaceAll(":", "")
            link.download = `brnd-leaderboard-${date}-${time}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Error exporting:", error)
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="mt-4 w-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm">🏆</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        {title || "BRND Week Leaderboard"}
                    </h3>
                </div>
                <Button
                    onClick={handleExportPNG}
                    disabled={exporting || !allowExport}
                    variant="secondary"
                    size="sm"
                    className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-[10px] h-7 px-2.5"
                >
                    {exporting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Download className="w-3 h-3" />
                    )}
                    PNG
                </Button>
            </div>

            <div ref={exportRef} className="rounded-xl overflow-hidden border border-zinc-800/50">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/50 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Brand</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-3 text-center">🥇 🥈 🥉</div>
                    <div className="col-span-2 text-right">Podiums</div>
                </div>

                {/* Entries */}
                <div className="divide-y divide-zinc-800/30">
                    {entries.map((entry) => (
                        <div
                            key={entry.rank}
                            className={`grid grid-cols-12 gap-2 px-3 py-2 items-center transition-colors hover:bg-zinc-900/40 ${entry.rank <= 3 ? "bg-zinc-900/20" : ""}`}
                        >
                            {/* Rank */}
                            <div className="col-span-1 flex items-center">
                                <div className={getRankBadge(entry.rank)}>
                                    {entry.rank}
                                </div>
                            </div>

                            {/* Brand */}
                            <div className="col-span-4 flex items-center gap-2 min-w-0">
                                {entry.imageUrl ? (
                                    <div className="w-7 h-7 flex-shrink-0">
                                        <Image
                                            src={entry.imageUrl}
                                            alt={entry.name}
                                            width={28}
                                            height={28}
                                            sizes="28px"
                                            quality={90}
                                            className="rounded-md ring-1 ring-zinc-800 block w-7 h-7 object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-7 h-7 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-600 text-[10px] font-bold flex-shrink-0">
                                        {entry.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <p className="font-semibold text-white text-xs truncate">{entry.name}</p>
                            </div>

                            {/* Score */}
                            <div className="col-span-2 text-center">
                                <span className={`text-sm font-black font-mono ${entry.rank === 1 ? "text-yellow-400" : entry.rank === 2 ? "text-zinc-300" : entry.rank === 3 ? "text-amber-500" : "text-white"}`}>
                                    {entry.score.toLocaleString()}
                                </span>
                            </div>

                            {/* Vote Breakdown */}
                            <div className="col-span-3 flex items-center justify-center gap-2 font-mono text-[11px]">
                                <span className="text-zinc-300">{entry.gold}</span>
                                <span className="text-zinc-500">/</span>
                                <span className="text-zinc-400">{entry.silver}</span>
                                <span className="text-zinc-500">/</span>
                                <span className="text-zinc-500">{entry.bronze}</span>
                            </div>

                            {/* Total Podiums */}
                            <div className="col-span-2 text-right">
                                <span className="text-zinc-400 font-mono text-xs font-semibold">
                                    {entry.totalPodiums.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Función para detectar si los datos son de un leaderboard
export function isLeaderboardData(data: Record<string, unknown>[]): boolean {
    if (!data || data.length === 0) return false
    const firstRow = data[0]
    const keys = Object.keys(firstRow).map(k => k.toLowerCase())

    // Detectar si tiene campos típicos de leaderboard
    const hasScore = keys.some(k => k.includes("score"))
    const hasPodiums = keys.some(k => k.includes("vote") || k.includes("podium") || k.includes("gold") || k.includes("silver") || k.includes("bronze") || k.includes("brand1") || k.includes("brand2") || k.includes("brand3"))
    const hasBrand = keys.some(k => k.includes("name") || k.includes("brand"))

    return hasScore && hasPodiums && hasBrand
}
