import { NextResponse } from "next/server"
import { getRecentPodiums, SeasonRegistry } from "@/lib/seasons"
import { incrementCounter, recordLatency } from "@/lib/metrics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? parseInt(limitParam, 10) : 10

  const startMs = Date.now()
  let ok = false

  try {
    const activeSeason = SeasonRegistry.getActiveSeason()
    const podiums = await getRecentPodiums(limit)

    ok = true
    await incrementCounter("api.admin.seasons.podiums.ok")
    return NextResponse.json({
      ...podiums,
      meta: {
        activeSeason: activeSeason?.name ?? null,
        dataSource: activeSeason?.dataSource ?? null,
      },
    })
  } catch (error) {
    await incrementCounter("api.admin.seasons.podiums.error")
    console.error("Podiums API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch podiums",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    )
  } finally {
    await recordLatency("api.admin.seasons.podiums", Date.now() - startMs, ok)
  }
}
