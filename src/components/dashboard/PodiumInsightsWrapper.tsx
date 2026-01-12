"use client"

import dynamic from "next/dynamic"

const PodiumInsights = dynamic(
    () => import("@/components/dashboard/PodiumInsights").then((mod) => ({ default: mod.PodiumInsights })),
    { ssr: false },
)

export function PodiumInsightsWrapper() {
    return <PodiumInsights />
}
