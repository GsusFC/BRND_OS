import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasAnyPermission, PERMISSIONS } from "@/lib/auth/permissions"
import prismaIndexer from "@/lib/prisma-indexer"
import type { Prisma } from "@prisma/client-indexer"

const normalizeQuery = (raw: string): string => raw.trim().replace(/^#+/, "")

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const qRaw = searchParams.get("q")
        const limitRaw = searchParams.get("limit")
        const pageRaw = searchParams.get("page")
        const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 200)
        const page = Math.max(Number(pageRaw) || 1, 1)
        const skip = (page - 1) * limit

        const hasQuery = typeof qRaw === "string" && qRaw.trim().length > 0

        const queryMode = "insensitive" as const
        let whereClause: Prisma.IndexerBrandWhereInput | undefined

        if (hasQuery) {
            const q = normalizeQuery(qRaw ?? "")
            if (q) {
                const tokens = q
                    .split(/\s+/)
                    .map((token) => token.trim())
                    .filter(Boolean)
                    .filter((token) => token.toLowerCase() !== "fid")

                const numericToken = tokens.find((token) => /^\d+$/.test(token))
                const textToken = tokens.find((token) => !/^\d+$/.test(token))

                const orFilters: Prisma.IndexerBrandWhereInput[] = []
                if (numericToken) {
                    const numericValue = Number(numericToken)
                    orFilters.push({ id: numericValue }, { fid: numericValue })
                }
                if (textToken) {
                    orFilters.push({ handle: { contains: textToken, mode: queryMode } })
                }

                whereClause = orFilters.length > 0
                    ? { OR: orFilters }
                    : { handle: { contains: q, mode: queryMode } }
            }
        }

        const results = hasQuery && whereClause
            ? await (async () => {
                return prismaIndexer.indexerBrand.findMany({
                    where: whereClause,
                    take: limit,
                    skip,
                    orderBy: { id: "desc" },
                })
            })()
            : await prismaIndexer.indexerBrand.findMany({
                take: limit,
                skip,
                orderBy: { id: "desc" },
            })

        const totalCount = await prismaIndexer.indexerBrand.count({
            where: whereClause,
        })
        const totalPages = Math.max(Math.ceil(totalCount / limit), 1)

        return NextResponse.json({
            success: true,
            page,
            pageSize: limit,
            totalCount,
            totalPages,
            brands: results.map((row) => ({
                id: row.id,
                fid: row.fid,
                handle: row.handle,
                walletAddress: row.wallet_address,
                metadataHash: row.metadata_hash,
                createdAt: row.created_at.toString(),
            })),
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error"
        console.error("Admin indexer brand search error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
