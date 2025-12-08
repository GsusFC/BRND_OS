"use client"

import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"

const LiveLeaderboard = dynamic(
    () => import("./LiveLeaderboard").then(mod => ({ default: mod.LiveLeaderboard })),
    {
        loading: () => (
            <Card className="rounded-xl p-6 h-[720px] animate-pulse bg-[#212020]/50 border-[#484E55]/50">
                <div className="flex items-center justify-between mb-5">
                    <div className="h-4 w-32 bg-zinc-800 rounded" />
                    <div className="h-4 w-20 bg-zinc-900 rounded" />
                </div>
                <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-14 bg-zinc-900 rounded-lg" />
                    ))}
                </div>
            </Card>
        ),
        ssr: false
    }
)

export function LiveLeaderboardWrapper() {
    return <LiveLeaderboard />
}
