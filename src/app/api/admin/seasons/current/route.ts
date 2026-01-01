import { NextResponse } from "next/server"
import { SeasonRegistry } from "@/lib/seasons"

export const dynamic = "force-dynamic"

export async function GET() {
  const activeSeason = SeasonRegistry.getActiveSeason()
  const currentRound = SeasonRegistry.getCurrentRound()
  const seasonWithRounds = activeSeason 
    ? SeasonRegistry.getSeasonWithRounds(activeSeason.id)
    : null

  return NextResponse.json({
    activeSeason: activeSeason ? {
      id: activeSeason.id,
      name: activeSeason.name,
      startAt: activeSeason.startAt.toISOString(),
      endAt: activeSeason.endAt?.toISOString() ?? null,
      totalRounds: activeSeason.totalRounds,
      dataSource: activeSeason.dataSource,
    } : null,
    currentRound: currentRound ? {
      roundNumber: currentRound.roundNumber,
      startAt: currentRound.startAt.toISOString(),
      endAt: currentRound.endAt.toISOString(),
      status: currentRound.status,
    } : null,
    allRounds: seasonWithRounds?.rounds.map(r => ({
      roundNumber: r.roundNumber,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      status: r.status,
    })) ?? [],
    timestamp: new Date().toISOString(),
  })
}
