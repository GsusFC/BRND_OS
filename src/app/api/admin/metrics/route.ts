import { NextResponse } from "next/server"
import assert from "node:assert"
import { getCounters, getLatencyAggregates, withTiming } from "@/lib/metrics"

export const dynamic = "force-dynamic"

const parseMinutes = (value: string | null): number => {
  if (!value) return 60
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 60
  const minutes = Math.floor(parsed)
  if (minutes <= 0) return 60
  if (minutes > 24 * 60) return 24 * 60
  return minutes
}

export async function GET(request: Request) {
  return withTiming("api.admin.metrics", async () => {
    const { searchParams } = new URL(request.url)
    const minutes = parseMinutes(searchParams.get("minutes"))

    const [latency, counters] = await Promise.all([
      getLatencyAggregates(minutes),
      getCounters(minutes),
    ])

    const usersHit = counters["cache.hit.leaderboard_users_alltime"] ?? 0
    const usersMiss = counters["cache.miss.leaderboard_users_alltime"] ?? 0
    const brandsHit = counters["cache.hit.leaderboard_brands_alltime"] ?? 0
    const brandsMiss = counters["cache.miss.leaderboard_brands_alltime"] ?? 0

    const safeRate = (hit: number, miss: number): number | null => {
      assert(Number.isFinite(hit) && hit >= 0, "Invalid hit counter")
      assert(Number.isFinite(miss) && miss >= 0, "Invalid miss counter")

      const total = hit + miss
      if (total === 0) return null
      return hit / total
    }

    return NextResponse.json({
      windowMinutes: minutes,
      generatedAt: new Date().toISOString(),
      latency,
      counters,
      derived: {
        cacheHitRate: {
          leaderboardUsersAllTime: safeRate(usersHit, usersMiss),
          leaderboardBrandsAllTime: safeRate(brandsHit, brandsMiss),
        },
      },
    })
  })
}
