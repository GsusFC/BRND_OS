"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import html2canvas from "html2canvas"
import { Download, Loader2, RefreshCw } from "lucide-react"

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

const EXPORT_WIDTH = 1150
const EXPORT_HEIGHT = 860
const REFRESH_INTERVAL = 30000 // 30 segundos

export function LiveLeaderboard() {
    const [data, setData] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const exportRef = useRef<HTMLDivElement>(null)

    const fetchData = async () => {
        try {
            const res = await fetch("/api/leaderboard", {
                cache: "no-store",
            })
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const json = await res.json()
            if (json.data) {
                // Mapear totalVotes a totalPodiums para compatibilidad
                const mappedData = json.data.map((entry: Record<string, unknown>) => ({
                    ...entry,
                    totalPodiums: entry.totalVotes ?? entry.totalPodiums ?? 0
                }))
                setData(mappedData)
                setLastUpdated(new Date(json.updatedAt))
            }
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error)
            // No mostrar error en UI, simplemente mantener datos anteriores o vacíos
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [])

    const handleExportPNG = async () => {
        setExporting(true)
        try {
            const tempContainer = document.createElement("div")
            tempContainer.style.position = "absolute"
            tempContainer.style.left = "-9999px"
            tempContainer.style.width = `${EXPORT_WIDTH}px`
            tempContainer.style.height = `${EXPORT_HEIGHT}px`
            tempContainer.style.backgroundColor = "#ffffff"
            tempContainer.style.padding = "32px"
            tempContainer.style.fontFamily = "system-ui, -apple-system, sans-serif"
            tempContainer.style.boxSizing = "border-box"
            document.body.appendChild(tempContainer)

            tempContainer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
                    <div style="border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; background: #ffffff;">
                        <div style="display: grid; grid-template-columns: 70px 1fr 130px 220px 110px; gap: 16px; padding: 18px 28px; background: #fafafa; border-bottom: 1px solid #e4e4e7; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a;">
                            <div>Rank</div>
                            <div>Brand</div>
                            <div style="text-align: center;">Score</div>
                            <div style="text-align: center;">Podium Breakdown</div>
                            <div style="text-align: right;">Total Podiums</div>
                        </div>
                        ${data.map((entry, idx) => `
                            <div style="display: grid; grid-template-columns: 70px 1fr 130px 220px 110px; gap: 16px; padding: 12px 28px; align-items: center; ${idx < data.length - 1 ? 'border-bottom: 1px solid #f4f4f5;' : ''} ${idx < 3 ? 'background: #fafafa;' : ''} box-sizing: border-box;">
                                <div style="display: flex; align-items: center; justify-content: flex-start;">
                                    <div style="width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; line-height: 36px; text-align: center; box-sizing: border-box; ${
                                        idx === 0 ? 'background: linear-gradient(135deg, #facc15, #eab308); color: white;' :
                                        idx === 1 ? 'background: linear-gradient(135deg, #d4d4d8, #a1a1aa); color: white;' :
                                        idx === 2 ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: white;' :
                                        'background: #f4f4f5; color: #71717a; border: 1px solid #e4e4e7;'
                                    }">${idx + 1}</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    ${entry.imageUrl 
                                        ? `<img src="${entry.imageUrl}" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e4e4e7;" crossorigin="anonymous" />`
                                        : `<div style="width: 36px; height: 36px; border-radius: 8px; background: #f4f4f5; display: flex; align-items: center; justify-content: center; color: #a1a1aa; font-weight: 700; font-size: 14px;">${entry.name.charAt(0).toUpperCase()}</div>`
                                    }
                                    <div>
                                        <p style="font-weight: 700; color: #18181b; margin: 0; font-size: 14px;">${entry.name}</p>
                                        ${entry.channel ? `<p style="font-size: 11px; color: #a1a1aa; margin: 2px 0 0 0;">/${entry.channel}</p>` : ''}
                                    </div>
                                </div>
                                <div style="text-align: center;">
                                    <span style="font-size: 16px; font-weight: 900; color: ${
                                        idx === 0 ? '#7c3aed' :
                                        idx === 1 ? '#6366f1' :
                                        idx === 2 ? '#8b5cf6' :
                                        '#18181b'
                                    };">
                                        ${entry.score.toLocaleString()}
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px;">
                                    <span style="display: flex; align-items: center; gap: 4px;">
                                        <span>🥇</span>
                                        <span style="color: #52525b;">${entry.gold.toLocaleString()}</span>
                                    </span>
                                    <span style="display: flex; align-items: center; gap: 4px;">
                                        <span>🥈</span>
                                        <span style="color: #71717a;">${entry.silver.toLocaleString()}</span>
                                    </span>
                                    <span style="display: flex; align-items: center; gap: 4px;">
                                        <span>🥉</span>
                                        <span style="color: #a1a1aa;">${entry.bronze.toLocaleString()}</span>
                                    </span>
                                </div>
                                <div style="text-align: right;">
                                    <span style="color: #71717a; font-weight: 600; font-size: 13px;">${entry.totalPodiums.toLocaleString()}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `

            await new Promise(resolve => setTimeout(resolve, 500))

            const canvas = await html2canvas(tempContainer, {
                width: EXPORT_WIDTH,
                height: EXPORT_HEIGHT,
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                allowTaint: true,
            })

            const link = document.createElement("a")
            link.download = `brnd-leaderboard-${new Date().toISOString().split('T')[0]}.png`
            link.href = canvas.toDataURL("image/png")
            link.click()

            document.body.removeChild(tempContainer)
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
            <div className="card-gradient rounded-xl p-6">
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                </div>
            </div>
        )
    }

    return (
        <div className="card-gradient rounded-xl p-6">
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
                    {lastUpdated && (
                        <span className="text-[10px] font-mono text-zinc-600">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExportPNG}
                        disabled={exporting}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                        {exporting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Download className="w-3 h-3" />
                        )}
                        PNG
                    </button>
                </div>
            </div>

            {/* Table */}
            <div ref={exportRef} className="rounded-xl border border-zinc-800 overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-4">Brand</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-3 text-center">Podiums</div>
                    <div className="col-span-2 text-right">Total</div>
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
                                    <Image
                                        src={entry.imageUrl}
                                        alt={entry.name}
                                        width={28}
                                        height={28}
                                        className="rounded-md ring-1 ring-zinc-800"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs font-bold">
                                        {entry.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm text-white font-medium truncate">{entry.name}</p>
                                </div>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`text-sm font-black font-mono ${
                                    index === 0 ? "text-yellow-400" : 
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
                                    <span className="text-zinc-400">{entry.gold}</span>
                                </span>
                                <span className="flex items-center gap-1 min-w-[40px]">
                                    <span>🥈</span>
                                    <span className="text-zinc-500">{entry.silver}</span>
                                </span>
                                <span className="flex items-center gap-1 min-w-[40px]">
                                    <span>🥉</span>
                                    <span className="text-zinc-600">{entry.bronze}</span>
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
        </div>
    )
}
