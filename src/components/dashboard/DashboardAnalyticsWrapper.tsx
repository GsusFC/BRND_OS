"use client"

import dynamic from "next/dynamic"

const DashboardAnalytics = dynamic(
    () => import("./DashboardAnalytics").then(mod => ({ default: mod.DashboardAnalytics })),
    {
        loading: () => (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-xl bg-zinc-900 h-24" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-zinc-900 h-80" />
                    <div className="rounded-xl bg-zinc-900 h-80" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="rounded-xl bg-zinc-900 h-64" />
                    <div className="rounded-xl bg-zinc-900 h-64" />
                    <div className="rounded-xl bg-zinc-900 h-64" />
                </div>
            </div>
        ),
    }
)

export function DashboardAnalyticsWrapper() {
    return <DashboardAnalytics />
}
