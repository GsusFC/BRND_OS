import { Card } from "@/components/ui/card"

export function LiveLeaderboardSkeleton() {
    return (
        <Card className="rounded-xl p-6 h-[720px] animate-pulse bg-[#212020]/50 border-[#484E55]/50">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-zinc-800 rounded" />
                    <div className="h-4 w-48 bg-zinc-800 rounded" />
                    <div className="h-6 w-16 bg-zinc-900 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-4 w-24 bg-zinc-900 rounded" />
                    <div className="h-8 w-8 bg-zinc-900 rounded" />
                    <div className="h-8 w-16 bg-zinc-900 rounded" />
                </div>
            </div>
            <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-14 bg-zinc-900 rounded-lg" />
                ))}
            </div>
        </Card>
    )
}
