import { NextResponse } from "next/server"
import { getWeeklyBrandLeaderboard, SeasonRegistry } from "@/lib/seasons"
import { incrementCounter, recordLatency } from "@/lib/metrics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const roundParam = searchParams.get("round")
  const limit = limitParam ? parseInt(limitParam, 10) : 10
  const round = roundParam ? parseInt(roundParam, 10) : undefined

  const startMs = Date.now()
  let ok = false

  try {
    const activeSeason = SeasonRegistry.getActiveSeason()

    // Check if the adapter supports getAvailableRounds (it should if it's our IndexerAdapter)
    // We cast or check the property existence safely
    const adapter = activeSeason?.adapter as any
    const availableRounds = typeof adapter?.getAvailableRounds === 'function'
      ? await adapter.getAvailableRounds()
      : []

    // If the adapter supports filtering by round, pass it
    // The SeasonAdapter interface might need update, but for now we pass it if the function follows the IndexerAdapter signature
    const leaderboard = await activeSeason?.adapter.getWeeklyBrandLeaderboard(limit, round)

    ok = true
    await incrementCounter("api.admin.seasons.leaderboard.ok")
    return NextResponse.json({
      ...leaderboard,
      meta: {
        activeSeason: activeSeason?.name ?? null,
        dataSource: activeSeason?.dataSource ?? null,
        availableRounds,
      },
    })
  } catch (error) {
    await incrementCounter("api.admin.seasons.leaderboard.error")
    console.error("Leaderboard API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    )
  } finally {
    await recordLatency("api.admin.seasons.leaderboard", Date.now() - startMs, ok)
  }
}
