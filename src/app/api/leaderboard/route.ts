import { NextResponse } from "next/server"
import { getWeeklyBrandLeaderboard, SeasonRegistry } from "@/lib/seasons"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const leaderboard = await getWeeklyBrandLeaderboard(10)
        const activeSeason = SeasonRegistry.getActiveSeason()

        // Transformar al formato esperado por el frontend
        const data = leaderboard.data.map((brand) => ({
            id: brand.id,
            name: brand.name,
            imageUrl: brand.imageUrl,
            channel: brand.channel,
            score: brand.points,
            gold: brand.gold,
            silver: brand.silver,
            bronze: brand.bronze,
            totalVotes: brand.totalVotes,
        }))

        return NextResponse.json({ 
            data,
            updatedAt: leaderboard.updatedAt,
            seasonId: leaderboard.seasonId,
            roundNumber: leaderboard.roundNumber,
            dataSource: activeSeason?.dataSource ?? null,
        })
    } catch (error) {
        console.error("Leaderboard API error:", error)
        return NextResponse.json(
            { error: "Failed to fetch leaderboard", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}
