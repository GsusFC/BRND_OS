"use client"

import dynamic from "next/dynamic"

const BrandEvolutionChart = dynamic(
    () => import("@/components/intelligence/BrandEvolutionChart").then(mod => ({ default: mod.BrandEvolutionChart })),
    { loading: () => <div className="h-[500px] bg-zinc-900 rounded-xl animate-pulse" /> }
)

export function BrandEvolutionWrapper() {
    return <BrandEvolutionChart />
}
