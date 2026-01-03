import { Suspense } from 'react'
import { getWeeklyBrandLeaderboard, SeasonRegistry } from '@/lib/seasons'
import { LiveLeaderboard } from './LiveLeaderboard'
import { LiveLeaderboardSkeleton } from './LiveLeaderboardSkeleton'

const toSafeNumber = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "bigint") return Number(value)
    if (typeof value === "string") {
        const n = Number(value)
        if (Number.isFinite(n)) return n
    }
    return 0
}

async function LiveLeaderboardData() {
    const leaderboard = await getWeeklyBrandLeaderboard(10)
    const activeSeason = SeasonRegistry.getActiveSeason()

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
        totalPodiums: toSafeNumber(brand.totalVotes),
    }))

    return (
        <LiveLeaderboard
            initialData={data}
            initialUpdatedAt={leaderboard.updatedAt}
            initialSeasonId={leaderboard.seasonId}
            initialRoundNumber={leaderboard.roundNumber}
        />
    )
}

export function LiveLeaderboardServer() {
    return (
        <Suspense fallback={<LiveLeaderboardSkeleton />}>
            <LiveLeaderboardData />
        </Suspense>
    )
}
