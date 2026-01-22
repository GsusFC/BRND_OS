import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getBrandsForEvolution, type BrandInfo } from "@/lib/intelligence/brand-evolution"

export const dynamic = 'force-dynamic'
const MYSQL_DISABLED = process.env.MYSQL_DISABLED === "true"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const brandIds = searchParams.get("brandIds")?.split(",").map(Number).filter(Boolean) || []
        const granularity = searchParams.get("granularity") || "day" // day, week, month

        // Obtener todas las marcas para el selector (usando función cacheada)
        const allBrands = await getBrandsForEvolution()

        // Si no hay brandIds, devolver solo las marcas disponibles
        if (brandIds.length === 0) {
            return NextResponse.json({
                brands: allBrands,
                data: [],
            })
        }

        if (MYSQL_DISABLED) {
            return NextResponse.json({
                brands: allBrands,
                data: [],
                colors: {},
                selectedBrands: brandIds.map(id => allBrands.find((b: BrandInfo) => b.id === id)).filter(Boolean),
            })
        }

        // Obtener votos históricos para las marcas seleccionadas
        const votes = await prisma.userBrandVote.findMany({
            where: {
                OR: [
                    { brand1Id: { in: brandIds } },
                    { brand2Id: { in: brandIds } },
                    { brand3Id: { in: brandIds } },
                ],
            },
            select: {
                date: true,
                brand1Id: true,
                brand2Id: true,
                brand3Id: true,
            },
            orderBy: { date: "asc" },
        })

        // Agregar votos por fecha y marca
        const aggregatedData = new Map<string, Record<number, number>>()

        for (const vote of votes) {
            const dateKey = formatDateKey(vote.date, granularity)

            if (!aggregatedData.has(dateKey)) {
                aggregatedData.set(dateKey, {})
            }

            const dayData = aggregatedData.get(dateKey)!

            // Contar votos por posición (3 puntos para 1º, 2 para 2º, 1 para 3º)
            if (vote.brand1Id && brandIds.includes(vote.brand1Id)) {
                dayData[vote.brand1Id] = (dayData[vote.brand1Id] || 0) + 3
            }
            if (vote.brand2Id && brandIds.includes(vote.brand2Id)) {
                dayData[vote.brand2Id] = (dayData[vote.brand2Id] || 0) + 2
            }
            if (vote.brand3Id && brandIds.includes(vote.brand3Id)) {
                dayData[vote.brand3Id] = (dayData[vote.brand3Id] || 0) + 1
            }
        }

        // Convertir a formato para gráficas con acumulado
        const brandTotals: Record<number, number> = {}
        brandIds.forEach(id => brandTotals[id] = 0)

        const chartData = Array.from(aggregatedData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, dayVotes]) => {
                // Acumular votos
                brandIds.forEach(id => {
                    brandTotals[id] += dayVotes[id] || 0
                })

                const entry: Record<string, string | number> = { date }
                brandIds.forEach(id => {
                    const brand = allBrands.find((b: BrandInfo) => b.id === id)
                    if (brand) {
                        entry[brand.name] = brandTotals[id]
                    }
                })
                return entry
            })

        // Crear mapa de colores para las marcas
        const brandColors: Record<string, string> = {}
        const colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
            "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
        ]
        brandIds.forEach((id, index) => {
            const brand = allBrands.find((b: BrandInfo) => b.id === id)
            if (brand) {
                brandColors[brand.name] = colors[index % colors.length]
            }
        })

        return NextResponse.json({
            brands: allBrands,
            data: chartData,
            colors: brandColors,
            selectedBrands: brandIds.map(id => allBrands.find((b: BrandInfo) => b.id === id)).filter(Boolean),
        })
    } catch (error) {
        console.error("Error fetching brand evolution:", error)
        return NextResponse.json(
            { error: "Failed to fetch brand evolution data" },
            { status: 500 }
        )
    }
}

function formatDateKey(date: Date, granularity: string): string {
    const d = new Date(date)
    
    switch (granularity) {
        case "week": {
            // Obtener el lunes de la semana
            const day = d.getDay()
            const diff = d.getDate() - day + (day === 0 ? -6 : 1)
            d.setDate(diff)
            return d.toISOString().split("T")[0]
        }
        case "month":
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
        case "day":
        default:
            return d.toISOString().split("T")[0]
    }
}
