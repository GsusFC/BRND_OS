"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"


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
}


export function WeekLeaderboard({ data, title }: WeekLeaderboardProps) {
    const exportRef = useRef<HTMLDivElement>(null)
    const [exporting, setExporting] = useState(false)

    if (!data || data.length === 0) return null

    // Transformar datos al formato del leaderboard
    const entries: LeaderboardEntry[] = data.map((row, index) => ({
        rank: index + 1,
        name: String(row.name || row.brand_name || row.Brand || "Unknown"),
        imageUrl: row.imageUrl as string | undefined || row.image_url as string | undefined,
        channel: row.channel as string | undefined,
        score: Number(row.score || row.Score || row.scoreWeek || row.score_week || 0),
        gold: Number(row.gold || row.Gold || row.brand1_votes || row.first_place || 0),
        silver: Number(row.silver || row.Silver || row.brand2_votes || row.second_place || 0),
        bronze: Number(row.bronze || row.Bronze || row.brand3_votes || row.third_place || 0),
        totalPodiums: Number(row.totalVotes || row.total_votes || row.TotalVotes || row.totalPodiums || 0),
    }))

    const getRankBadge = (rank: number, isExport = false) => {
        const baseClasses = `w-10 h-10 rounded-full flex items-center justify-center font-black text-lg`
        if (isExport) {
            // Versión para exportación (light mode)
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
        // Versión dark mode (UI)
        switch (rank) {
            case 1:
                return `${baseClasses} bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/30`
            case 2:
                return `${baseClasses} bg-gradient-to-br from-zinc-300 to-zinc-500 text-black shadow-lg shadow-zinc-400/30`
            case 3:
                return `${baseClasses} bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-700/30`
            default:
                return `${baseClasses} bg-zinc-800 text-zinc-400 border border-zinc-700`
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
            link.download = `brnd-leaderboard-${new Date().toISOString().split('T')[0]}.png`
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
        <div className="mt-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <h3 className="text-xl font-black text-white font-display uppercase tracking-wider">
                        {title || "BRND Week Leaderboard"}
                    </h3>
                </div>
                <Button
                    onClick={handleExportPNG}
                    disabled={exporting}
                    variant="secondary"
                    className="bg-white text-black hover:bg-zinc-200 font-bold text-sm"
                >
                    {exporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Export PNG
                </Button>
            </div>

            <Card ref={exportRef} className="rounded-2xl border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-4">Brand</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-3 text-center">Podium Breakdown</div>
                    <div className="col-span-2 text-right">Total Podiums</div>
                </div>

                {/* Entries */}
                <div className="divide-y divide-zinc-800/50">
                    {entries.map((entry) => (
                        <div
                            key={entry.rank}
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all hover:bg-zinc-900/50 ${entry.rank <= 3 ? "bg-zinc-900/30" : ""}`}
                        >
                            {/* Rank */}
                            <div className="col-span-1">
                                <div className={getRankBadge(entry.rank)}>
                                    {entry.rank}
                                </div>
                            </div>

                            {/* Brand */}
                            <div className="col-span-4 flex items-center gap-3">
                                {entry.imageUrl ? (
                                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                        <Image
                                            src={entry.imageUrl}
                                            alt={entry.name}
                                            width={40}
                                            height={40}
                                            sizes="40px"
                                            quality={100}
                                            className="rounded-lg ring-1 ring-zinc-800 block"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 font-bold">
                                        {entry.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex items-center h-10">
                                    <p className="font-bold text-white leading-none relative -top-0.5">{entry.name}</p>
                                    {/* Channel removed */}
                                </div>
                            </div>

                            {/* Score */}
                            <div className="col-span-2 text-center">
                                <span className={`text-xl font-black font-mono ${entry.rank === 1 ? "text-yellow-400" : entry.rank === 2 ? "text-zinc-300" : entry.rank === 3 ? "text-amber-500" : "text-white"}`}>
                                    {entry.score.toLocaleString()}
                                </span>
                            </div>

                            {/* Vote Breakdown */}
                            <div className="col-span-3 flex items-center justify-center gap-4 font-mono text-sm">
                                <span className="flex items-center gap-1">
                                    <span className="text-base">🥇</span>
                                    <span className="text-zinc-300">{entry.gold.toLocaleString()}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="text-base">🥈</span>
                                    <span className="text-zinc-400">{entry.silver.toLocaleString()}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="text-base">🥉</span>
                                    <span className="text-zinc-500">{entry.bronze.toLocaleString()}</span>
                                </span>
                            </div>

                            {/* Total Podiums */}
                            <div className="col-span-2 text-right">
                                <span className="text-zinc-400 font-mono font-bold">
                                    {entry.totalPodiums.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
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
