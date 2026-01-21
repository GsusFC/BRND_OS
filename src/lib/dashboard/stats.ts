import { unstable_cache } from "next/cache"
import assert from "node:assert/strict"
import prisma from "@/lib/prisma"
import prismaIndexer from "@/lib/prisma-indexer"
import { Prisma } from "@prisma/client-indexer"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { CANONICAL_CATEGORY_NAMES } from "@/lib/brand-categories"

const indexerSchema = process.env.INDEXER_DATABASE_URL?.match(/(?:\?|&)schema=([^&]+)/)?.[1] ?? "(default)"
const INDEXER_DISABLED = process.env.INDEXER_DISABLED === "true"

export interface DashboardStats {
    votesPerDay: Array<{ date: string; count: number }>
    topVoters: Array<{ userId: number; username: string; photoUrl: string | null; points: number; voteCount: number }>
    trending: Array<{ id: number; name: string; imageUrl: string | null; thisWeek: number; lastWeek: number; growth: number }>
    categoryDistribution: Array<{ name: string; count: number }>
    newUsers: { thisWeek: number; lastWeek: number; growth: number }
    engagement: { totalUsers: number; activeUsersWeek: number; activeRate: number; avgVotesPerUser: number; retentionRate: number }
    votesByHour: Array<{ hour: number; count: number }>
    updatedAt?: string
}

const emptyStats: DashboardStats = {
    votesPerDay: [],
    topVoters: [],
    trending: [],
    categoryDistribution: [],
    newUsers: { thisWeek: 0, lastWeek: 0, growth: 0 },
    engagement: { totalUsers: 0, activeUsersWeek: 0, activeRate: 0, avgVotesPerUser: 0, retentionRate: 0 },
    votesByHour: [],
}

// Función cacheada que obtiene los stats
export const getDashboardStats = unstable_cache(
    async (): Promise<DashboardStats> => {
        if (INDEXER_DISABLED) {
            return emptyStats
        }
        const now = new Date()
        const msPerDay = 24 * 60 * 60 * 1000
        const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        const weekStart = new Date(startOfTodayUtc.getTime() - 7 * msPerDay)
        const monthStart = new Date(startOfTodayUtc.getTime() - 30 * msPerDay)
        const twoWeeksAgo = new Date(startOfTodayUtc.getTime() - 14 * msPerDay)

        const monthStartSec = Math.floor(monthStart.getTime() / 1000)
        const weekStartSec = Math.floor(weekStart.getTime() / 1000)
        const twoWeeksAgoSec = Math.floor(twoWeeksAgo.getTime() / 1000)

        assert(Number.isInteger(monthStartSec) && monthStartSec > 0, "Invalid monthStartSec")
        assert(Number.isInteger(weekStartSec) && weekStartSec > 0, "Invalid weekStartSec")
        assert(Number.isInteger(twoWeeksAgoSec) && twoWeeksAgoSec > 0, "Invalid twoWeeksAgoSec")
        assert(twoWeeksAgoSec < weekStartSec, "Expected twoWeeksAgoSec < weekStartSec")

        // Ejecutar queries en paralelo para mayor velocidad
        const [votesPerDayRows, topVotersRows, hourRows, weeksRows, newUsersRows, engagementRows, categories] = await Promise.all([
            prismaIndexer.$queryRaw<Array<{ date: string; count: number }>>(Prisma.sql`
                SELECT
                    to_char(date_trunc('day', to_timestamp("timestamp"::double precision)), 'YYYY-MM-DD') AS date,
                    COUNT(*)::int AS count
                FROM votes
                WHERE "timestamp" >= ${monthStartSec}
                GROUP BY 1
                ORDER BY 1 ASC
            `),
            prismaIndexer.$queryRaw<Array<{ fid: number; voteCount: number }>>(Prisma.sql`
                SELECT
                    fid,
                    COUNT(*)::int AS "voteCount"
                FROM votes
                WHERE "timestamp" >= ${weekStartSec}
                GROUP BY fid
                ORDER BY "voteCount" DESC
                LIMIT 10
            `),
            prismaIndexer.$queryRaw<Array<{ hour: number; count: number }>>(Prisma.sql`
                SELECT
                    EXTRACT(HOUR FROM to_timestamp("timestamp"::double precision))::int AS hour,
                    COUNT(*)::int AS count
                FROM votes
                WHERE "timestamp" >= ${weekStartSec}
                GROUP BY 1
                ORDER BY 1 ASC
            `),
            prismaIndexer.$queryRaw<Array<{ week: Prisma.Decimal }>>(Prisma.sql`
                SELECT DISTINCT week
                FROM weekly_brand_leaderboard
                ORDER BY week DESC
                LIMIT 2
            `),
            prismaIndexer.$queryRaw<Array<{ thisWeek: number; lastWeek: number }>>(Prisma.sql`
                WITH first_votes AS (
                    SELECT fid, MIN("timestamp") AS first_ts
                    FROM votes
                    GROUP BY fid
                )
                SELECT
                    COUNT(*) FILTER (WHERE first_ts >= ${weekStartSec} AND first_ts < ${Math.floor(now.getTime() / 1000)})::int AS "thisWeek",
                    COUNT(*) FILTER (WHERE first_ts >= ${twoWeeksAgoSec} AND first_ts < ${weekStartSec})::int AS "lastWeek"
                FROM first_votes
            `),
            prismaIndexer.$queryRaw<Array<{ totalUsers: number; activeUsersWeek: number; totalVotesWeek: number; retained: number; lastWeekUsers: number }>>(Prisma.sql`
                WITH this_week AS (
                    SELECT DISTINCT fid
                    FROM votes
                    WHERE "timestamp" >= ${weekStartSec}
                ),
                last_week AS (
                    SELECT DISTINCT fid
                    FROM votes
                    WHERE "timestamp" >= ${twoWeeksAgoSec} AND "timestamp" < ${weekStartSec}
                ),
                retained AS (
                    SELECT fid FROM this_week
                    INTERSECT
                    SELECT fid FROM last_week
                )
                SELECT
                    (SELECT COUNT(*)::int FROM users) AS "totalUsers",
                    (SELECT COUNT(*)::int FROM this_week) AS "activeUsersWeek",
                    (SELECT COUNT(*)::int FROM votes WHERE "timestamp" >= ${weekStartSec}) AS "totalVotesWeek",
                    (SELECT COUNT(*)::int FROM retained) AS "retained",
                    (SELECT COUNT(*)::int FROM last_week) AS "lastWeekUsers"
            `),
            prisma.category.findMany({
                where: { name: { in: Array.from(CANONICAL_CATEGORY_NAMES) } },
                select: { name: true, _count: { select: { brands: true } } }
            }),
        ])

        const votesPerDay = votesPerDayRows
            .filter((r) => typeof r.date === "string" && Number.isFinite(r.count))
            .map((r) => ({ date: r.date, count: Number(r.count) }))

        const votesByHour = Array.from({ length: 24 }, (_, i) => {
            const row = hourRows.find((h) => Number(h.hour) === i)
            const count = row ? Number(row.count) : 0
            assert(Number.isFinite(count) && count >= 0, "Invalid votesByHour count")
            return { hour: i, count }
        })

        const topVoterFids = topVotersRows.map((r) => Number(r.fid)).filter((fid) => Number.isInteger(fid) && fid > 0)
        const usersMetadata = await getUsersMetadata(topVoterFids, { fetchMissingFromNeynar: true })

        const topVoters = topVotersRows
            .map((row) => {
                const fid = Number(row.fid)
                const voteCount = Number(row.voteCount)
                assert(Number.isInteger(fid) && fid > 0, "Invalid fid in topVoters")
                assert(Number.isFinite(voteCount) && voteCount >= 0, "Invalid voteCount in topVoters")
                const meta = usersMetadata.get(fid)
                return {
                    userId: fid,
                    voteCount,
                    username: meta?.username ?? meta?.displayName ?? `fid:${fid}`,
                    photoUrl: meta?.pfpUrl ?? null,
                    points: 0,
                }
            })

        const categoryDistribution = categories
            .filter(c => c._count.brands > 0)
            .map(c => ({ name: c.name, count: c._count.brands }))
            .sort((a, b) => b.count - a.count)

        const newUsersThisWeek = newUsersRows[0]?.thisWeek ?? 0
        const newUsersLastWeek = newUsersRows[0]?.lastWeek ?? 0

        assert(Number.isFinite(newUsersThisWeek) && newUsersThisWeek >= 0, "Invalid newUsersThisWeek")
        assert(Number.isFinite(newUsersLastWeek) && newUsersLastWeek >= 0, "Invalid newUsersLastWeek")

        const engagementRow = engagementRows[0]
        assert(engagementRow, "Missing engagementRow")
        assert(Number.isFinite(engagementRow.totalUsers) && engagementRow.totalUsers >= 0, "Invalid totalUsers")
        assert(Number.isFinite(engagementRow.activeUsersWeek) && engagementRow.activeUsersWeek >= 0, "Invalid activeUsersWeek")
        assert(Number.isFinite(engagementRow.totalVotesWeek) && engagementRow.totalVotesWeek >= 0, "Invalid totalVotesWeek")
        assert(Number.isFinite(engagementRow.lastWeekUsers) && engagementRow.lastWeekUsers >= 0, "Invalid lastWeekUsers")
        assert(Number.isFinite(engagementRow.retained) && engagementRow.retained >= 0, "Invalid retained")

        const retentionRate = engagementRow.lastWeekUsers > 0
            ? Math.round((engagementRow.retained / engagementRow.lastWeekUsers) * 100)
            : 0

        const activeRate = engagementRow.totalUsers > 0
            ? Math.round((engagementRow.activeUsersWeek / engagementRow.totalUsers) * 100)
            : 0

        const avgVotesPerUser = engagementRow.activeUsersWeek > 0
            ? Math.round((engagementRow.totalVotesWeek / engagementRow.activeUsersWeek) * 10) / 10
            : 0

        const weeks = weeksRows.map((w) => w.week)
        const currentWeek = weeks[0] ?? null
        const prevWeek = weeks[1] ?? null

        const trending = await (async () => {
            if (!currentWeek) return []

            const current = await prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
                where: { week: currentWeek },
                orderBy: { points: "desc" },
                take: 5,
                select: { brand_id: true, gold_count: true, silver_count: true, bronze_count: true },
            })

            const ids = current.map((c) => c.brand_id)
            const [meta, previous] = await Promise.all([
                getBrandsMetadata(ids),
                prevWeek
                    ? prismaIndexer.indexerWeeklyBrandLeaderboard.findMany({
                        where: { week: prevWeek, brand_id: { in: ids } },
                        select: { brand_id: true, gold_count: true, silver_count: true, bronze_count: true },
                    })
                    : Promise.resolve([]),
            ])

            const prevMap = new Map(previous.map((p) => [p.brand_id, p.gold_count + p.silver_count + p.bronze_count]))

            return current.map((c) => {
                const thisWeek = c.gold_count + c.silver_count + c.bronze_count
                const lastWeek = prevMap.get(c.brand_id) ?? 0
                const growth = lastWeek > 0
                    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
                    : thisWeek > 0 ? 100 : 0

                const m = meta.get(c.brand_id)
                return {
                    id: c.brand_id,
                    name: m?.name ?? `Brand #${c.brand_id}`,
                    imageUrl: m?.imageUrl ?? null,
                    thisWeek,
                    lastWeek,
                    growth,
                }
            })
        })()

        return {
            votesPerDay,
            topVoters,
            trending,
            categoryDistribution,
            newUsers: {
                thisWeek: newUsersThisWeek,
                lastWeek: newUsersLastWeek,
                growth: newUsersLastWeek > 0
                    ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
                    : newUsersThisWeek > 0 ? 100 : 0
            },
            engagement: {
                totalUsers: engagementRow.totalUsers,
                activeUsersWeek: engagementRow.activeUsersWeek,
                activeRate,
                avgVotesPerUser,
                retentionRate,
            },
            votesByHour,
        }
    },
    ['dashboard-stats', indexerSchema],
    { revalidate: 60, tags: ['dashboard'] }
)
