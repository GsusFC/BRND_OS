import { Decimal } from "@prisma/client/runtime/library"

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS
const INDEXER_POINTS_SCALED_THRESHOLD = BigInt(1_000_000_000_000)

export const LIVE_WEEKLY_VOTE_WEIGHTS = {
  gold: 100,
  silver: 50,
  bronze: 25,
} as const

export const normalizeThresholdIndexerPoints = (raw: unknown): number => {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === "number") return raw
  if (typeof raw === "bigint") {
    if (raw < INDEXER_POINTS_SCALED_THRESHOLD) return Number(raw)
    const whole = raw / BRND_SCALE
    if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Indexer points overflow: ${whole.toString()}`)
    }
    const frac = raw % BRND_SCALE
    return Number(whole) + Number(frac) / 1e18
  }

  const input = String(raw)
  if (input.length === 0) return 0

  const normalized = new Decimal(input).toFixed(0)
  const value = BigInt(normalized)

  if (value < INDEXER_POINTS_SCALED_THRESHOLD) {
    return Number(value)
  }

  const whole = value / BRND_SCALE
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Indexer points overflow: ${whole.toString()}`)
  }
  const frac = value % BRND_SCALE
  return Number(whole) + Number(frac) / 1e18
}

export function normalizeAlwaysScaledIndexerPoints(raw: Decimal | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === "number") return raw

  const str = raw.toFixed(0)
  if (!/^[0-9]+$/.test(str)) {
    throw new Error(`Invalid indexer points value: ${str}`)
  }

  const value = BigInt(str)
  const whole = value / BRND_SCALE
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Indexer points overflow: ${whole.toString()}`)
  }

  const frac = value % BRND_SCALE
  return Number(whole) + Number(frac) / 1e18
}

export function aggregateLiveWeeklyBrandStats(voteBrandIds: string[]): Array<{
  id: number
  gold: number
  silver: number
  bronze: number
  points: number
  totalVotes: number
}> {
  const brandStats = new Map<number, { gold: number; silver: number; bronze: number; points: number }>()

  for (const brandIdsJson of voteBrandIds) {
    try {
      const brandIds: number[] = JSON.parse(brandIdsJson)

      if (brandIds[0]) {
        const stats = brandStats.get(brandIds[0]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
        stats.gold++
        stats.points += LIVE_WEEKLY_VOTE_WEIGHTS.gold
        brandStats.set(brandIds[0], stats)
      }
      if (brandIds[1]) {
        const stats = brandStats.get(brandIds[1]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
        stats.silver++
        stats.points += LIVE_WEEKLY_VOTE_WEIGHTS.silver
        brandStats.set(brandIds[1], stats)
      }
      if (brandIds[2]) {
        const stats = brandStats.get(brandIds[2]) ?? { gold: 0, silver: 0, bronze: 0, points: 0 }
        stats.bronze++
        stats.points += LIVE_WEEKLY_VOTE_WEIGHTS.bronze
        brandStats.set(brandIds[2], stats)
      }
    } catch {
      // Skip malformed votes, matching the live leaderboard runtime behavior.
    }
  }

  return Array.from(brandStats.entries())
    .map(([id, stats]) => ({
      id,
      ...stats,
      totalVotes: stats.gold + stats.silver + stats.bronze,
    }))
    .sort((a, b) => b.points - a.points || b.gold - a.gold)
}
