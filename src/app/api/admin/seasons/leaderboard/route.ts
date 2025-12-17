import { NextResponse } from "next/server"
import { getWeeklyBrandLeaderboard, SeasonRegistry } from "@/lib/seasons"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? parseInt(limitParam, 10) : 10

  try {
    const activeSeason = SeasonRegistry.getActiveSeason()
    const leaderboard = await getWeeklyBrandLeaderboard(limit)

    return NextResponse.json({
      ...leaderboard,
      meta: {
        activeSeason: activeSeason?.name ?? null,
        dataSource: activeSeason?.dataSource ?? null,
      },
    })
  } catch (error) {
    console.error("Leaderboard API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    )
  }
}
