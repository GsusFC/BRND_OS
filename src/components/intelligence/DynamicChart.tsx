"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
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
    ResponsiveContainer
} from "recharts"

interface DynamicChartProps {
    type: "bar" | "line" | "pie" | "area" | "table"
    data: Record<string, unknown>[]
    xAxisKey?: string
    dataKey?: string
    title?: string
}

const GRADIENT_COLORS = ["#FFF100", "#FF0000", "#0C00FF", "#00FF00"]

export function DynamicChart({ type, data, xAxisKey, dataKey, title }: DynamicChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted || !data || data.length === 0 || type === "table") return null

    // Format data for charts if necessary
    const chartData = data.map(item => ({
        ...item,
        [dataKey!]: Number(item[dataKey!]) // Ensure numbers are numbers
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl">
                    <p className="text-zinc-300 font-mono text-xs mb-1">{label}</p>
                    <p className="text-white font-bold font-mono">
                        {payload[0].value}
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <Card className="w-full h-[300px] mt-4 bg-[#212020]/50 border-[#484E55]/50 p-4">
            {title && (
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4 text-center">
                    {title}
                </h3>
            )}

            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                {type === "bar" ? (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={CustomTooltip} cursor={{ fill: '#ffffff10' }} />
                        <Bar dataKey={dataKey!} fill="#fff" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                ) : type === "line" ? (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
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
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                        />
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
        </Card>
    )
}
