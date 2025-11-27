"use client"

import dynamic from "next/dynamic"

const DynamicChart = dynamic(
    () => import("./DynamicChart").then(mod => ({ default: mod.DynamicChart })),
    {
        loading: () => (
            <div className="h-64 bg-zinc-900 rounded-xl animate-pulse" />
        ),
        ssr: false
    }
)

interface DynamicChartWrapperProps {
    type: "bar" | "line" | "pie" | "area" | "table"
    data: Record<string, unknown>[]
    xAxisKey?: string
    dataKey?: string
    title?: string
}

export function DynamicChartWrapper(props: DynamicChartWrapperProps) {
    return <DynamicChart {...props} />
}
