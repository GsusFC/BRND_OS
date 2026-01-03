"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Download, Loader2, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"


interface LeaderboardEntry {
    id: number
    name: string
    imageUrl: string | null
    channel: string | null
    score: number
    gold: number
    silver: number
    bronze: number
    totalPodiums: number
}

interface LiveLeaderboardProps {
    initialData?: LeaderboardEntry[]
    initialUpdatedAt?: Date
    initialSeasonId?: number | null
    initialRoundNumber?: number | null
}

const REFRESH_INTERVAL = 300000 // 300 segundos

const toSafeNumber = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "bigint") return Number(value)
    if (typeof value === "string") {
        const n = Number(value)
        if (Number.isFinite(n)) return n
    }
    return 0
}

export function LiveLeaderboard({
    initialData = [],
    initialUpdatedAt,
    initialSeasonId,
    initialRoundNumber
}: LiveLeaderboardProps = {}) {
    const [data, setData] = useState<LeaderboardEntry[]>(initialData)
    const [loading, setLoading] = useState(!initialData || initialData.length === 0)
    const [exporting, setExporting] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(initialUpdatedAt ?? null)
    const [seasonId, setSeasonId] = useState<number | null>(initialSeasonId ?? null)
    const [roundNumber, setRoundNumber] = useState<number | null>(initialRoundNumber ?? null)
    const exportRef = useRef<HTMLDivElement>(null)

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/leaderboard", {
                cache: "no-store",
            })
            if (!res.ok) {
                const text = await res.text().catch(() => 'No error details')
                console.error('Leaderboard API Error Body:', text)
                throw new Error(`HTTP ${res.status}: ${text}`)
            }
            const json = await res.json()
            if (json.data) {
                // Mapear totalVotes a totalPodiums para compatibilidad
                const mappedData: LeaderboardEntry[] = json.data.map((entry: Record<string, unknown>) => ({
                    id: toSafeNumber(entry.id),
                    name: typeof entry.name === "string" ? entry.name : "",
                    imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : null,
                    channel: typeof entry.channel === "string" ? entry.channel : null,
                    score: toSafeNumber(entry.score),
                    gold: toSafeNumber(entry.gold),
                    silver: toSafeNumber(entry.silver),
                    bronze: toSafeNumber(entry.bronze),
                    totalPodiums: toSafeNumber(entry.totalVotes ?? entry.totalPodiums),
                }))
                setData(mappedData)
                setLastUpdated(new Date(json.updatedAt))
                setSeasonId(typeof json.seasonId === "number" ? json.seasonId : null)
                setRoundNumber(typeof json.roundNumber === "number" ? json.roundNumber : null)
            }
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error)
            // No mostrar error en UI, simplemente mantener datos anteriores o vacíos
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchData])

    const handleExportPNG = async () => {
        setExporting(true)
        try {
            const entries = data.map((entry, index) => ({
                rank: index + 1,
                name: entry.name,
                imageUrl: entry.imageUrl || undefined,
                score: entry.score,
                gold: entry.gold,
                silver: entry.silver,
                bronze: entry.bronze,
                totalPodiums: entry.totalPodiums
            }))

            const response = await fetch('/api/leaderboard/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entries: entries.slice(0, 10),
                    title: "BRND Live Leaderboard"
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

    const getRankBadge = (rank: number) => {
        const baseClasses = "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
        switch (rank) {
            case 1:
                return `${baseClasses} bg-gradient-to-br from-yellow-400 to-yellow-600 text-black`
            case 2:
                return `${baseClasses} bg-gradient-to-br from-zinc-300 to-zinc-500 text-black`
            case 3:
                return `${baseClasses} bg-gradient-to-br from-amber-600 to-amber-800 text-white`
            default:
                return `${baseClasses} bg-zinc-800 text-zinc-400`
        }
    }

    if (loading) {
        return (
            <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                </div>
            </Card>
        )
    }

    return (
        <Card className="rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">BRND Week Leaderboard</h3>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-green-400">LIVE</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {seasonId !== null && (
                        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                            Season {String(seasonId).padStart(2, "0")}
                            {roundNumber !== null ? `  •  Round ${roundNumber}` : ""}
                        </span>
                    )}
                    {lastUpdated && (
                        <span className="text-[10px] font-mono text-zinc-600">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        onClick={fetchData}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-white"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={handleExportPNG}
                        disabled={exporting}
                        variant="secondary"
                        size="sm"
                        className="bg-white text-black hover:bg-zinc-200 font-bold text-xs"
                    >
                        {exporting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Download className="w-3 h-3" />
                        )}
                        PNG
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div ref={exportRef} className="rounded-xl border border-zinc-800 overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-4">Brand</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-3 text-center">Vote Breakdown</div>
                    <div className="col-span-2 text-right">Total Votes</div>
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-zinc-800/50">
                    {data.map((entry, index) => (
                        <Link
                            key={entry.id}
                            href={`/dashboard/brands/${entry.id}`}
                            className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-zinc-900/50 transition-colors ${index < 3 ? "bg-zinc-900/30" : ""}`}
                        >
                            <div className="col-span-1">
                                <div className={getRankBadge(index + 1)}>
                                    {index + 1}
                                </div>
                            </div>
                            <div className="col-span-4 flex items-center gap-2">
                                {entry.imageUrl ? (
                                    <div className="w-7 h-7 flex items-center justify-center shrink-0">
                                        <Image
                                            src={entry.imageUrl}
                                            alt={entry.name}
                                            width={28}
                                            height={28}
                                            sizes="28px"
                                            quality={100}
                                            className="rounded-md ring-1 ring-zinc-800 block"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs font-bold">
                                        {entry.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex items-center h-7">
                                    <p className="text-sm text-white font-medium truncate leading-none relative -top-0.5">{entry.name}</p>
                                    {/* Channel removed */}
                                </div>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`text-sm font-black font-mono ${index === 0 ? "text-yellow-400" :
                                    index === 1 ? "text-zinc-300" :
                                        index === 2 ? "text-amber-500" :
                                            "text-white"
                                    }`}>
                                    {entry.score.toLocaleString()}
                                </span>
                            </div>
                            <div className="col-span-3 flex items-center justify-center gap-3 text-xs font-mono">
                                <span className="flex items-center gap-1 min-w-[40px]">
                                    <span>🥇</span>
                                    <span className="text-zinc-400">{entry.gold.toLocaleString()}</span>
                                </span>
                                <span className="flex items-center gap-1 min-w-[40px]">
                                    <span>🥈</span>
                                    <span className="text-zinc-500">{entry.silver.toLocaleString()}</span>
                                </span>
                                <span className="flex items-center gap-1 min-w-[40px]">
                                    <span>🥉</span>
                                    <span className="text-zinc-600">{entry.bronze.toLocaleString()}</span>
                                </span>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="text-sm text-zinc-400 font-mono">
                                    {entry.totalPodiums.toLocaleString()}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </Card>
    )
}
