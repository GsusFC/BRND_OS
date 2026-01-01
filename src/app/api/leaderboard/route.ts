import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { getWeeklyBrandLeaderboard, SeasonRegistry } from "@/lib/seasons"
import { incrementCounter, recordLatency } from "@/lib/metrics"

export const dynamic = "force-dynamic"

const getWeeklyBrandLeaderboardCached = unstable_cache(
    async () => getWeeklyBrandLeaderboard(10),
    ["api:leaderboard:weekly:top10:v2"],
    { revalidate: 300 }
)

export async function GET() {
    const startMs = Date.now()
    let ok = false

    try {
        const leaderboard = await getWeeklyBrandLeaderboardCached()
        const activeSeason = SeasonRegistry.getActiveSeason()

        const toSafeNumber = (value: unknown): number => {
            if (typeof value === "number" && Number.isFinite(value)) return value
            if (typeof value === "bigint") return Number(value)
            if (typeof value === "string") {
                const n = Number(value)
                if (Number.isFinite(n)) return n
            }
            return 0
        }

        // Transformar al formato esperado por el frontend
        const data = leaderboard.data.map((brand) => ({
            id: brand.id,
            name: brand.name,
            imageUrl: brand.imageUrl,
            channel: brand.channel,
            score: toSafeNumber(brand.points),
            gold: toSafeNumber(brand.gold),
            silver: toSafeNumber(brand.silver),
            bronze: toSafeNumber(brand.bronze),
            totalVotes: toSafeNumber(brand.totalVotes),
        }))

        ok = true
        await incrementCounter("api.leaderboard.ok")
        return NextResponse.json({ 
            data,
            updatedAt: leaderboard.updatedAt,
            seasonId: leaderboard.seasonId,
            roundNumber: leaderboard.roundNumber,
            dataSource: activeSeason?.dataSource ?? null,
        })
    } catch (error) {
        await incrementCounter("api.leaderboard.error")
        console.error("Leaderboard API error:", error)
        return NextResponse.json(
            { error: "Failed to fetch leaderboard", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    } finally {
        await recordLatency("api.leaderboard", Date.now() - startMs, ok)
    }
}
