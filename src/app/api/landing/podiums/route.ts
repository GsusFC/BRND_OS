import { NextResponse } from "next/server"
import { getRecentPodiums } from "@/lib/api/podiums"

export const dynamic = 'force-dynamic'

export async function GET() {
    const podiums = await getRecentPodiums()
    return NextResponse.json({ podiums })
}
