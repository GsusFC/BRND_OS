"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"

type PodiumAnalytics = {
    days: string[]
    momentum: Array<Record<string, string | number>>
    share: Array<Record<string, string | number>>
    newEntrants: Array<{ date: string; count: number }>
    concentration: Array<{ date: string; hhi: number }>
    churn: Array<{ date: string; churn: number }>
    heatmap: {
        dates: string[]
        brands: Array<{ id: number; name: string }>
        ranks: Record<number, Record<string, number>>
    }
    streaks: Array<{ id: number; name: string; currentStreak: number; longestStreak: number; lastSeen: string | null }>
}

const COLORS = ["#facc15", "#60a5fa", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"]

const LegendRow = ({ label, color }: { label: string; color: string }) => (
    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
    </div>
)

const TooltipShell = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl text-xs font-mono">
        <div className="text-zinc-500 mb-1">{label}</div>
        <div className="text-white font-bold">{value}</div>
    </div>
)

const formatDayLabel = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })

export function PodiumInsights() {
    const [data, setData] = useState<PodiumAnalytics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/dashboard/podium-analytics?days=60", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text().catch(() => "")
                    throw new Error(text || `HTTP ${res.status}`)
                }
                return res.json()
            })
            .then((json) => {
                if (!json.error) setData(json)
            })
            .catch((err) => console.error("Podium insights error:", err))
            .finally(() => setLoading(false))
    }, [])

    const visibleHeatmapDays = useMemo(() => {
        if (!data) return []
        return data.heatmap.dates.slice(-14)
    }, [data])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-72">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    if (!data) {
        return <div className="text-zinc-500 text-sm">Failed to load podium insights.</div>
    }

    const momentumKeys = Object.keys(data.momentum[0] || {}).filter((key) => key !== "date")
    const shareKeys = Object.keys(data.share[0] || {}).filter((key) => key !== "date")

    const heatmapColors: Record<number, string> = {
        1: "bg-yellow-400/80 text-black",
        2: "bg-zinc-300/80 text-black",
        3: "bg-amber-500/80 text-black",
        4: "bg-zinc-800 text-zinc-300",
        5: "bg-zinc-800 text-zinc-300",
        6: "bg-zinc-800 text-zinc-300",
        7: "bg-zinc-800 text-zinc-300",
        8: "bg-zinc-800 text-zinc-300",
        9: "bg-zinc-800 text-zinc-300",
        10: "bg-zinc-800 text-zinc-300",
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Momentum (Weighted Points)</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Mide la fuerza diaria combinando puntos oro/plata/bronce. Cada linea es una marca; el color identifica la marca.
                    </p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.momentum}>
                                <CartesianGrid stroke="rgba(39,39,42,0.4)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                                <Tooltip content={({ label, payload }) => {
                                    if (!label || !payload?.length) return null
                                    const first = payload[0]
                                    return <TooltipShell label={formatDayLabel(String(label))} value={`${first.name}: ${Number(first.value).toLocaleString()}`} />
                                }} />
                                {momentumKeys.map((key, index) => (
                                    <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
                        {momentumKeys.map((key, index) => (
                            <LegendRow key={key} label={key} color={COLORS[index % COLORS.length]} />
                        ))}
                    </div>
                </Card>

                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Share of Podiums</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Porcentaje diario de podiums por marca (100% acumulado). El color indica la marca y el area apilada su cuota.
                    </p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.share}>
                                <CartesianGrid stroke="rgba(39,39,42,0.4)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <Tooltip content={({ label, payload }) => {
                                    if (!label || !payload?.length) return null
                                    const first = payload[0]
                                    return <TooltipShell label={formatDayLabel(String(label))} value={`${first.name}: ${(Number(first.value) * 100).toFixed(1)}%`} />
                                }} />
                                {shareKeys.map((key, index) => (
                                    <Area key={key} type="monotone" dataKey={key} stackId="share" stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.3} />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
                        {shareKeys.map((key, index) => (
                            <LegendRow key={key} label={key} color={COLORS[index % COLORS.length]} />
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">New Entrants (Top 10)</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Numero de marcas nuevas que entran al Top 10 cada dia. Barras en amarillo para destacar novedades.
                    </p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.newEntrants}>
                                <CartesianGrid stroke="rgba(39,39,42,0.4)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                                <Tooltip content={({ label, payload }) => {
                                    if (!label || !payload?.length) return null
                                    return <TooltipShell label={formatDayLabel(String(label))} value={`${payload[0].value} new`} />
                                }} />
                                <Bar dataKey="count" fill="#facc15" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Concentration (HHI)</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Indice de concentracion del leaderboard. Azul = mayor concentracion cuando sube la linea.
                    </p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.concentration}>
                                <CartesianGrid stroke="rgba(39,39,42,0.4)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                                <Tooltip content={({ label, payload }) => {
                                    if (!label || !payload?.length) return null
                                    return <TooltipShell label={formatDayLabel(String(label))} value={`HHI ${(Number(payload[0].value)).toFixed(2)}`} />
                                }} />
                                <Line type="monotone" dataKey="hhi" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Leaderboard Churn</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Porcentaje diario de cambios en el Top 10. Naranja = mas rotacion cuanto mas alto.
                    </p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.churn}>
                                <CartesianGrid stroke="rgba(39,39,42,0.4)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={{ fontSize: 10 }} stroke="#71717a" />
                                <Tooltip content={({ label, payload }) => {
                                    if (!label || !payload?.length) return null
                                    return <TooltipShell label={formatDayLabel(String(label))} value={`${(Number(payload[0].value) * 100).toFixed(1)}%`} />
                                }} />
                                <Line type="monotone" dataKey="churn" stroke="#f97316" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Top-10 Volatility Heatmap (Last 14 days)</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Cambios de ranking diarios. Colores: oro (1), plata (2), bronce (3). Gris oscuro = posiciones 4-10.
                    </p>
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px]">
                            <div className="grid" style={{ gridTemplateColumns: `180px repeat(${visibleHeatmapDays.length}, minmax(36px, 1fr))` }}>
                                <div className="text-[10px] uppercase font-mono text-zinc-500 py-2">Brand</div>
                                {visibleHeatmapDays.map((day) => (
                                    <div key={day} className="text-[10px] uppercase font-mono text-zinc-500 py-2 text-center">
                                        {formatDayLabel(day)}
                                    </div>
                                ))}
                                {data.heatmap.brands.map((brand) => (
                                    <div key={brand.id} className="contents">
                                        <div className="text-xs text-zinc-200 py-2 truncate">{brand.name}</div>
                                        {visibleHeatmapDays.map((day) => {
                                            const rank = data.heatmap.ranks[brand.id]?.[day] ?? 0
                                            const color = rank ? heatmapColors[rank] : "bg-zinc-900 text-zinc-700"
                                            return (
                                                <div key={`${brand.id}-${day}`} className={`h-8 rounded-md flex items-center justify-center text-xs font-mono ${color}`}>
                                                    {rank ? rank : ""}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-zinc-950 border-zinc-800 p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Top Streaks (Top 3)</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Rachas activas en Top 3. Amarillo indica dias consecutivos en podium.
                    </p>
                    <div className="space-y-3">
                        {data.streaks.length === 0 && (
                            <div className="text-zinc-500 text-sm">No active streaks.</div>
                        )}
                        {data.streaks.map((row) => (
                            <div key={row.id} className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-3">
                                <div>
                                    <div className="text-sm font-bold text-white">{row.name}</div>
                                    <div className="text-xs text-zinc-500">Last seen: {row.lastSeen ? formatDayLabel(row.lastSeen) : "—"}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono text-yellow-400">{row.currentStreak} days</div>
                                    <div className="text-xs text-zinc-500">Longest: {row.longestStreak}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}
