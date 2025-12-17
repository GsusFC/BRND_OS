import { NextResponse } from "next/server"
import { getRecentPodiums, SeasonRegistry } from "@/lib/seasons"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? parseInt(limitParam, 10) : 10

  try {
    const activeSeason = SeasonRegistry.getActiveSeason()
    const podiums = await getRecentPodiums(limit)

    return NextResponse.json({
      ...podiums,
      meta: {
        activeSeason: activeSeason?.name ?? null,
        dataSource: activeSeason?.dataSource ?? null,
      },
    })
  } catch (error) {
    console.error("Podiums API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch podiums",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    )
  }
}
