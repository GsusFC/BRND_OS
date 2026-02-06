"use client"

import { useState, useEffect } from "react"
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    AreaChart,
    Area,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList
} from "recharts"

interface DynamicChartProps {
    type: "bar" | "line" | "pie" | "area" | "table"
    data: Record<string, unknown>[]
    xAxisKey?: string
    dataKey?: string
    title?: string
}

const GRADIENT_COLORS = ["#FFF100", "#FF0000", "#0C00FF", "#00FF00"]

// Truncate long labels for the X axis
function truncateLabel(label: string, max = 18): string {
    if (!label || typeof label !== "string") return String(label ?? "")
    return label.length > max ? label.slice(0, max) + "…" : label
}

// Custom tick renderer for angled X-axis labels
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AngledTick({ x, y, payload }: any) {
    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={8}
                textAnchor="end"
                fill="#888"
                fontSize={10}
                fontFamily="monospace"
                transform="rotate(-40)"
            >
                {truncateLabel(payload.value)}
            </text>
        </g>
    )
}

export function DynamicChart({ type, data, xAxisKey, dataKey, title }: DynamicChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted || !data || data.length === 0 || type === "table") return null

    // Format ISO dates to readable format (e.g. "2026-01-06T00:00:00.000Z" → "6 Jan")
    function formatDate(val: unknown): string {
        if (typeof val !== "string") return String(val ?? "")
        // Match ISO date or YYYY-MM-DD
        const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
            const d = parseInt(isoMatch[3], 10)
            const m = parseInt(isoMatch[2], 10) - 1
            return `${d} ${months[m]}`
        }
        return val
    }

    // Format data for charts — clean dates on X axis
    const chartData = data.map(item => {
        const row = { ...item, [dataKey!]: Number(item[dataKey!]) }
        if (xAxisKey && row[xAxisKey]) {
            row[xAxisKey] = formatDate(row[xAxisKey])
        }
        return row
    })

    // Detect if X labels are long (podium-style: "brand1 / brand2 / brand3")
    const hasLongLabels = xAxisKey && chartData.some(item => {
        const val = String(item[xAxisKey] ?? "")
        return val.length > 12
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900/95 border border-zinc-700/50 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
                    <p className="text-zinc-400 font-mono text-[10px] mb-1 uppercase tracking-wider">{label}</p>
                    <p className="text-white font-bold font-mono text-sm">
                        {typeof payload[0].value === "number"
                            ? payload[0].value.toLocaleString()
                            : payload[0].value}
                    </p>
                </div>
            )
        }
        return null
    }

    // Shared axis props
    const xAxisProps = {
        dataKey: xAxisKey,
        stroke: "transparent",
        tickLine: false,
        axisLine: false,
        ...(hasLongLabels
            ? {
                tick: AngledTick as unknown as React.SVGProps<SVGTextElement>,
                height: 80,
                interval: 0 as const,
            }
            : {
                tick: { fill: '#888', fontSize: 10, fontFamily: 'monospace' } as React.SVGProps<SVGTextElement>,
            }),
    }

    const yAxisProps = {
        stroke: "transparent",
        tick: { fill: '#555', fontSize: 10, fontFamily: 'monospace' } as React.SVGProps<SVGTextElement>,
        tickLine: false,
        axisLine: false,
        width: 45,
    }

    // Dynamic height: taller when labels need room
    const chartHeight = hasLongLabels ? 380 : 300

    return (
        <div className={`w-full mt-4 p-4`} style={{ height: chartHeight, minHeight: 200 }}>
            {title && (
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4 text-center">
                    {title}
                </h3>
            )}

            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                {type === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: hasLongLabels ? 20 : 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip content={CustomTooltip} cursor={{ fill: '#ffffff08' }} />
                        <Bar dataKey={dataKey!} fill="#fff" radius={[4, 4, 0, 0]} barSize={36}>
                            <LabelList
                                dataKey={dataKey!}
                                position="top"
                                fill="#888"
                                fontSize={10}
                                fontFamily="monospace"
                                formatter={(value: unknown) => typeof value === "number" ? value.toLocaleString() : String(value ?? "")}
                            />
                        </Bar>
                    </BarChart>
                ) : type === "line" ? (
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: hasLongLabels ? 20 : 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip content={CustomTooltip} />
                        <Line
                            type="monotone"
                            dataKey={dataKey!}
                            stroke="#fff"
                            strokeWidth={2}
                            dot={{ fill: '#000', stroke: '#fff', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#fff' }}
                        />
                    </LineChart>
                ) : type === "area" ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: hasLongLabels ? 20 : 5 }}>
                        <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip content={CustomTooltip} />
                        <Area
                            type="monotone"
                            dataKey={dataKey!}
                            stroke="#fff"
                            strokeWidth={2}
                            fill="url(#colorGradient)"
                        />
                    </AreaChart>
                ) : type === "pie" ? (
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey={dataKey!}
                            nameKey={xAxisKey}
                        >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                            ))}
                        </Pie>
                        <Tooltip content={CustomTooltip} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-zinc-400 text-xs font-mono ml-1">{value}</span>}
                        />
                    </PieChart>
                ) : (
                    <BarChart data={chartData}>
                        <Bar dataKey={dataKey!} fill="#fff" />
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    )
}
