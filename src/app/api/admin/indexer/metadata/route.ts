import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasAnyPermission, PERMISSIONS } from "@/lib/auth/permissions"

const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
]

const MAX_ITEMS = 20

const fetchMetadata = async (metadataHash: string) => {
    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetch(`${gateway}${metadataHash}`)
            if (!response.ok) continue
            return await response.json()
        } catch {
            // Try next gateway
        }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canLookup = sessionUser.role === "admin"
        if (!canLookup) {
            const requester = await getAdminUser(sessionUser.fid)
            canLookup = hasAnyPermission(requester, [PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
        }

        if (!canLookup) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json().catch(() => null)
        const itemsRaw = Array.isArray(body?.items) ? body.items : []
        const items = itemsRaw
            .filter((entry: unknown) => {
                if (!entry || typeof entry !== "object") return false
                const record = entry as { id?: unknown; metadataHash?: unknown }
                return Number.isFinite(Number(record.id)) && typeof record.metadataHash === "string"
            })
            .slice(0, MAX_ITEMS)
            .map((entry: { id: number; metadataHash: string }) => ({
                id: Number(entry.id),
                metadataHash: entry.metadataHash.trim(),
            }))
            .filter((entry: { id: number; metadataHash: string }) => entry.metadataHash.length > 0)

        if (items.length === 0) {
            return NextResponse.json({ success: true, results: {} })
        }

        const results: Record<number, { name?: string; imageUrl?: string }> = {}
        await Promise.all(
            items.map(async (item: { id: number; metadataHash: string }) => {
                const data = await fetchMetadata(item.metadataHash)
                if (!data) return
                const name = typeof data.name === "string" ? data.name : undefined
                const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : undefined
                if (!name && !imageUrl) return
                results[item.id] = { name, imageUrl }
            })
        )

        return NextResponse.json({ success: true, results })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error"
        console.error("Admin metadata batch error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
