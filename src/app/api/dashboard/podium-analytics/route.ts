import { NextRequest, NextResponse } from "next/server"
import { Decimal } from "@prisma/client/runtime/library"
import prismaIndexer from "@/lib/prisma-indexer"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"

export const dynamic = "force-dynamic"

type DayStats = {
    totalPodiums: number
    brandPoints: Map<number, number>
    brandCounts: Map<number, number>
}

const parseBrandIds = (input: string): number[] => {
    try {
        const parsed = JSON.parse(input)
        if (Array.isArray(parsed)) {
            return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        }
    } catch {
        // ignore malformed rows
    }
    return []
}

const toDayKey = (timestampSeconds: number): string => {
    const date = new Date(timestampSeconds * 1000)
    return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const daysParam = Number(searchParams.get("days") ?? 60)
        const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 180) : 60

        const nowSeconds = Math.floor(Date.now() / 1000)
        const startSeconds = nowSeconds - days * 86400

        const votes = await prismaIndexer.indexerVote.findMany({
            where: {
                timestamp: {
                    gte: new Decimal(startSeconds),
                },
            },
            select: {
                timestamp: true,
                brand_ids: true,
            },
        })

        const dayMap = new Map<string, DayStats>()
        const brandTotals = new Map<number, { points: number; counts: number; top10Appearances: number }>()
        const dailyTop10 = new Map<string, number[]>()
        const dailyTop3 = new Map<string, number[]>()

        for (const vote of votes) {
            const timestampSeconds = Number(vote.timestamp)
            if (!Number.isFinite(timestampSeconds)) continue
            const dayKey = toDayKey(timestampSeconds)

            const brandIds = parseBrandIds(vote.brand_ids)
            if (brandIds.length === 0) continue

            const stats = dayMap.get(dayKey) ?? {
                totalPodiums: 0,
                brandPoints: new Map<number, number>(),
                brandCounts: new Map<number, number>(),
            }

            const positions = [
                { id: brandIds[0], points: 3 },
                { id: brandIds[1], points: 2 },
                { id: brandIds[2], points: 1 },
            ]

            for (const position of positions) {
                if (!position.id) continue
                stats.totalPodiums += 1
                stats.brandPoints.set(position.id, (stats.brandPoints.get(position.id) ?? 0) + position.points)
                stats.brandCounts.set(position.id, (stats.brandCounts.get(position.id) ?? 0) + 1)

                const total = brandTotals.get(position.id) ?? { points: 0, counts: 0, top10Appearances: 0 }
                total.points += position.points
                total.counts += 1
                brandTotals.set(position.id, total)
            }

            dayMap.set(dayKey, stats)
        }

        const daysSorted = Array.from(dayMap.keys()).sort()

        for (const dayKey of daysSorted) {
            const stats = dayMap.get(dayKey)
            if (!stats) continue
            const ranked = Array.from(stats.brandPoints.entries())
                .map(([id, points]) => ({ id, points, counts: stats.brandCounts.get(id) ?? 0 }))
                .sort((a, b) => b.points - a.points || b.counts - a.counts)

            const top10 = ranked.slice(0, 10).map((entry) => entry.id)
            const top3 = ranked.slice(0, 3).map((entry) => entry.id)
            dailyTop10.set(dayKey, top10)
            dailyTop3.set(dayKey, top3)

            for (const id of top10) {
                const total = brandTotals.get(id)
                if (total) {
                    total.top10Appearances += 1
                }
            }
        }

        const topMomentumBrandIds = Array.from(brandTotals.entries())
            .sort((a, b) => b[1].points - a[1].points)
            .slice(0, 5)
            .map(([id]) => id)

        const topShareBrandIds = Array.from(brandTotals.entries())
            .sort((a, b) => b[1].counts - a[1].counts)
            .slice(0, 5)
            .map(([id]) => id)

        const brandsMetadata = await getBrandsMetadata(Array.from(new Set([...topMomentumBrandIds, ...topShareBrandIds])))
        const brandName = (id: number) => brandsMetadata.get(id)?.name ?? `Brand #${id}`

        const momentum = daysSorted.map((dayKey) => {
            const stats = dayMap.get(dayKey)
            const entry: Record<string, string | number> = { date: dayKey }
            for (const id of topMomentumBrandIds) {
                entry[brandName(id)] = stats?.brandPoints.get(id) ?? 0
            }
            return entry
        })

        const share = daysSorted.map((dayKey) => {
            const stats = dayMap.get(dayKey)
            const total = stats?.totalPodiums ?? 0
            const entry: Record<string, string | number> = { date: dayKey }
            let accounted = 0
            for (const id of topShareBrandIds) {
                const count = stats?.brandCounts.get(id) ?? 0
                const ratio = total > 0 ? count / total : 0
                entry[brandName(id)] = Number(ratio.toFixed(4))
                accounted += ratio
            }
            entry["Others"] = Number(Math.max(0, 1 - accounted).toFixed(4))
            return entry
        })

        const newEntrants: { date: string; count: number }[] = []
        const churn: { date: string; churn: number }[] = []
        const seenTop10 = new Set<number>()
        let previousTop10: number[] | null = null

        for (const dayKey of daysSorted) {
            const top10 = dailyTop10.get(dayKey) ?? []
            let newCount = 0
            for (const id of top10) {
                if (!seenTop10.has(id)) newCount += 1
                seenTop10.add(id)
            }
            newEntrants.push({ date: dayKey, count: newCount })

            if (previousTop10) {
                const prevSet = new Set(previousTop10)
                const currentSet = new Set(top10)
                let overlap = 0
                for (const id of currentSet) {
                    if (prevSet.has(id)) overlap += 1
                }
                const churnRate = top10.length > 0 ? (top10.length - overlap) / top10.length : 0
                churn.push({ date: dayKey, churn: Number(churnRate.toFixed(4)) })
            } else {
                churn.push({ date: dayKey, churn: 0 })
            }

            previousTop10 = top10
        }

        const concentration = daysSorted.map((dayKey) => {
            const stats = dayMap.get(dayKey)
            const total = stats?.totalPodiums ?? 0
            if (!stats || total === 0) return { date: dayKey, hhi: 0 }
            let hhi = 0
            for (const count of stats.brandCounts.values()) {
                const shareValue = count / total
                hhi += shareValue * shareValue
            }
            return { date: dayKey, hhi: Number(hhi.toFixed(4)) }
        })

        const top10BrandsByPresence = Array.from(brandTotals.entries())
            .sort((a, b) => b[1].top10Appearances - a[1].top10Appearances)
            .slice(0, 10)
            .map(([id]) => id)

        const top10Names = await getBrandsMetadata(top10BrandsByPresence)
        const heatmapBrands = top10BrandsByPresence.map((id) => ({
            id,
            name: top10Names.get(id)?.name ?? `Brand #${id}`,
        }))

        const heatmap = {
            dates: daysSorted,
            brands: heatmapBrands,
            ranks: heatmapBrands.reduce<Record<number, Record<string, number>>>((acc, brand) => {
                acc[brand.id] = {}
                return acc
            }, {}),
        }

        for (const dayKey of daysSorted) {
            const top10 = dailyTop10.get(dayKey) ?? []
            for (const brand of heatmapBrands) {
                const rankIndex = top10.indexOf(brand.id)
                heatmap.ranks[brand.id][dayKey] = rankIndex >= 0 ? rankIndex + 1 : 0
            }
        }

        const streakMap = new Map<number, { current: number; longest: number; lastSeen: string | null }>()
        const dayKeys = daysSorted.slice()

        for (const dayKey of dayKeys) {
            const top3 = new Set(dailyTop3.get(dayKey) ?? [])
            for (const brand of heatmapBrands) {
                const record = streakMap.get(brand.id) ?? { current: 0, longest: 0, lastSeen: null }
                if (top3.has(brand.id)) {
                    record.current += 1
                    record.longest = Math.max(record.longest, record.current)
                    record.lastSeen = dayKey
                } else {
                    record.current = 0
                }
                streakMap.set(brand.id, record)
            }
        }

        const streaks = heatmapBrands
            .map((brand) => {
                const record = streakMap.get(brand.id) ?? { current: 0, longest: 0, lastSeen: null }
                return {
                    id: brand.id,
                    name: brand.name,
                    currentStreak: record.current,
                    longestStreak: record.longest,
                    lastSeen: record.lastSeen,
                }
            })
            .filter((entry) => entry.currentStreak > 0 || entry.longestStreak > 0)
            .sort((a, b) => b.currentStreak - a.currentStreak || b.longestStreak - a.longestStreak)
            .slice(0, 10)

        return NextResponse.json({
            days: daysSorted,
            momentum,
            share,
            newEntrants,
            concentration,
            churn,
            heatmap,
            streaks,
        })
    } catch (error) {
        console.error("Podium analytics error:", error)
        return NextResponse.json(
            { error: "Failed to compute podium analytics", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 },
        )
    }
}
