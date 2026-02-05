"use client"

import { useState, useEffect } from "react"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"

interface WeekData {
    week: string
    score: number
    gold: number
    silver: number
    bronze: number
}

interface BrandWeeklyChartProps {
    data: WeekData[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const d = payload[0].payload as WeekData
        return (
            <div className="bg-zinc-900/95 border border-zinc-700/50 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
                <p className="text-zinc-400 font-mono text-[10px] mb-1 uppercase tracking-wider">{label}</p>
                <p className="text-white font-bold font-mono text-sm mb-1">
                    {d.score.toLocaleString()} pts
                </p>
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span>🥇 {d.gold}</span>
                    <span>🥈 {d.silver}</span>
                    <span>🥉 {d.bronze}</span>
                </div>
            </div>
        )
    }
    return null
}

export function BrandWeeklyChart({ data }: BrandWeeklyChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted || data.length === 0) return null

    return (
        <div className="w-full" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis
                        dataKey="week"
                        stroke="transparent"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
                    />
                    <YAxis
                        stroke="transparent"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
                        width={45}
                    />
                    <Tooltip content={CustomTooltip} />
                    <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#fff"
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        dot={{ fill: '#000', stroke: '#fff', strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5, fill: '#fff' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
