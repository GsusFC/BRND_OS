import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"

// Función cacheada que obtiene los stats
const getCachedStats = unstable_cache(
    async () => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)
        const monthStart = new Date(todayStart)
        monthStart.setDate(monthStart.getDate() - 30)
        const twoWeeksAgo = new Date(weekStart)
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7)

        // Ejecutar queries en paralelo para mayor velocidad
        const [recentVotes, weekVotes, trendingBrands, categories, newUsersThisWeek, newUsersLastWeek, totalUsers, lastWeekVotes, recentVotesWithTime] = await Promise.all([
            // Votos últimos 30 días
            prisma.userBrandVote.findMany({
                where: { date: { gte: monthStart } },
                select: { date: true },
                orderBy: { date: 'asc' }
            }),
            // Votos esta semana
            prisma.userBrandVote.findMany({
                where: { date: { gte: weekStart } },
                select: { userId: true },
            }),
            // Top marcas
            prisma.brand.findMany({
                where: { banned: 0 },
                orderBy: { scoreWeek: 'desc' },
                take: 5,
                select: { id: true, name: true, imageUrl: true, scoreWeek: true }
            }),
            // Categorías
            prisma.category.findMany({
                select: { name: true, _count: { select: { brands: true } } }
            }),
            // Nuevos usuarios esta semana
            prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
            // Nuevos usuarios semana pasada
            prisma.user.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekStart } } }),
            // Total usuarios
            prisma.user.count(),
            // Votos semana pasada (retención)
            prisma.userBrandVote.findMany({
                where: { date: { gte: twoWeeksAgo, lt: weekStart } },
                select: { userId: true }
            }),
            // Votos con hora
            prisma.userBrandVote.findMany({
                where: { date: { gte: weekStart } },
                select: { date: true },
            }),
        ])

        // Procesar datos
        const votesPerDayMap = new Map<string, number>()
        recentVotes.forEach(v => {
            const dateStr = v.date.toISOString().split('T')[0]
            votesPerDayMap.set(dateStr, (votesPerDayMap.get(dateStr) || 0) + 1)
        })
        const votesPerDay = Array.from(votesPerDayMap.entries()).map(([date, count]) => ({ date, count }))

        // Top votantes
        const voterCounts = new Map<number, number>()
        weekVotes.forEach(v => {
            if (v.userId) voterCounts.set(v.userId, (voterCounts.get(v.userId) || 0) + 1)
        })
        const topVoterIds = Array.from(voterCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
        
        const topVoterUsers = await prisma.user.findMany({
            where: { id: { in: topVoterIds.map(v => v[0]) } },
            select: { id: true, username: true, photoUrl: true, points: true }
        })

        const topVoters = topVoterIds.map(([userId, voteCount]) => {
            const user = topVoterUsers.find(u => u.id === userId)
            return {
                userId, voteCount,
                username: user?.username || 'Unknown',
                photoUrl: user?.photoUrl || null,
                points: user?.points || 0,
            }
        })

        // Trending
        const trending = trendingBrands.map(b => ({
            id: b.id, name: b.name, imageUrl: b.imageUrl,
            thisWeek: b.scoreWeek, lastWeek: 0, growth: 100
        }))

        // Categorías
        const categoryDistribution = categories
            .filter(c => c._count.brands > 0)
            .map(c => ({ name: c.name, count: c._count.brands }))
            .sort((a, b) => b.count - a.count)

        // Engagement
        const activeUsersWeek = new Set(weekVotes.map(v => v.userId)).size
        const totalVotesWeek = weekVotes.length

        // Retención
        const lastWeekUsers = new Set(lastWeekVotes.map(v => v.userId))
        const thisWeekUsers = new Set(weekVotes.map(v => v.userId))
        const retained = Array.from(lastWeekUsers).filter(u => thisWeekUsers.has(u)).length
        const retentionRate = lastWeekUsers.size > 0 ? Math.round((retained / lastWeekUsers.size) * 100) : 0

        // Horas pico
        const hourCounts = new Map<number, number>()
        recentVotesWithTime.forEach(v => {
            const hour = v.date.getHours()
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
        })
        const votesByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourCounts.get(i) || 0 }))

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
                totalUsers,
                activeUsersWeek,
                activeRate: totalUsers > 0 ? Math.round((activeUsersWeek / totalUsers) * 100) : 0,
                avgVotesPerUser: activeUsersWeek > 0 ? Math.round((totalVotesWeek / activeUsersWeek) * 10) / 10 : 0,
                retentionRate,
            },
            votesByHour,
        }
    },
    ['dashboard-stats'],
    { revalidate: 300, tags: ['dashboard'] }
)

export async function GET() {
    try {
        const stats = await getCachedStats()
        return NextResponse.json({
            ...stats,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error("Dashboard stats API error:", error)
        return NextResponse.json(
            { error: "Failed to fetch stats", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}
