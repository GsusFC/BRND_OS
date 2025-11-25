import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)
        weekStart.setHours(0, 0, 0, 0)

        // Obtener top 10 marcas por scoreWeek
        const brands = await prisma.brand.findMany({
            where: { banned: 0 },
            orderBy: { scoreWeek: "desc" },
            take: 10,
            select: {
                id: true,
                name: true,
                imageUrl: true,
                channel: true,
                scoreWeek: true,
            }
        })

        // Obtener conteo de votos para cada marca
        const data = await Promise.all(brands.map(async (brand) => {
            const [gold, silver, bronze] = await Promise.all([
                prisma.userBrandVote.count({
                    where: { brand1Id: brand.id, date: { gte: weekStart } }
                }),
                prisma.userBrandVote.count({
                    where: { brand2Id: brand.id, date: { gte: weekStart } }
                }),
                prisma.userBrandVote.count({
                    where: { brand3Id: brand.id, date: { gte: weekStart } }
                }),
            ])

            return {
                name: brand.name,
                imageUrl: brand.imageUrl,
                channel: brand.channel,
                score: brand.scoreWeek,
                gold,
                silver,
                bronze,
                totalVotes: gold + silver + bronze,
            }
        }))

        return NextResponse.json({ 
            data,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error("Leaderboard API error:", error)
        return NextResponse.json(
            { error: "Failed to fetch leaderboard", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}
