"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import html2canvas from "html2canvas"
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

const EXPORT_WIDTH = 1150
const EXPORT_HEIGHT = 860

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
        if (!exportRef.current) return
        setExporting(true)

        try {
            // Crear un contenedor temporal con el tema claro
            const tempContainer = document.createElement("div")
            tempContainer.style.position = "absolute"
            tempContainer.style.left = "-9999px"
            tempContainer.style.width = `${EXPORT_WIDTH}px`
            tempContainer.style.height = `${EXPORT_HEIGHT}px`
            tempContainer.style.backgroundColor = "#ffffff"
            tempContainer.style.padding = "32px"
            tempContainer.style.fontFamily = "system-ui, -apple-system, sans-serif"
            document.body.appendChild(tempContainer)

            // Crear el HTML del leaderboard en tema claro (sin título, ajustado al contenido)
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
                        ${entries.map((entry, idx) => `
                            <div style="display: grid; grid-template-columns: 70px 1fr 130px 220px 110px; gap: 16px; padding: 12px 28px; align-items: center; ${idx < entries.length - 1 ? 'border-bottom: 1px solid #f4f4f5;' : ''} ${entry.rank <= 3 ? 'background: #fafafa;' : ''} box-sizing: border-box;">
                                <div style="display: flex; align-items: center; justify-content: flex-start;">
                                    <div style="width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; line-height: 36px; text-align: center; box-sizing: border-box; ${
                                        entry.rank === 1 ? 'background: linear-gradient(135deg, #facc15, #eab308); color: white;' :
                                        entry.rank === 2 ? 'background: linear-gradient(135deg, #d4d4d8, #a1a1aa); color: white;' :
                                        entry.rank === 3 ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: white;' :
                                        'background: #f4f4f5; color: #71717a; border: 1px solid #e4e4e7;'
                                    }">${entry.rank}</div>
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
                                        entry.rank === 1 ? '#7c3aed' :
                                        entry.rank === 2 ? '#6366f1' :
                                        entry.rank === 3 ? '#8b5cf6' :
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

            // Esperar a que las imágenes carguen
            await new Promise(resolve => setTimeout(resolve, 500))

            const canvas = await html2canvas(tempContainer, {
                width: EXPORT_WIDTH,
                height: EXPORT_HEIGHT,
                scale: 2, // Mayor resolución
                backgroundColor: "#ffffff",
                useCORS: true,
                allowTaint: true,
            })

            // Descargar
            const link = document.createElement("a")
            link.download = `brnd-leaderboard-${new Date().toISOString().split('T')[0]}.png`
            link.href = canvas.toDataURL("image/png")
            link.click()

            // Limpiar
            document.body.removeChild(tempContainer)
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
                                    <Image
                                        src={entry.imageUrl}
                                        alt={entry.name}
                                        width={40}
                                        height={40}
                                        className="rounded-lg ring-1 ring-zinc-800"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 font-bold">
                                        {entry.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-white">{entry.name}</p>
                                    {entry.channel && (
                                        <p className="text-xs text-zinc-500 font-mono">/{entry.channel}</p>
                                    )}
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
