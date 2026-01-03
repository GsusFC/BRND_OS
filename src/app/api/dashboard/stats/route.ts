import { NextResponse } from "next/server"
import { getDashboardStats } from "@/lib/dashboard/stats"

export async function GET() {
    try {
        const stats = await getDashboardStats()
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
