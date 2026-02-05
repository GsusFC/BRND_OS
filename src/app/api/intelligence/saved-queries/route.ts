import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"
import {
    getSavedQueries,
    saveQuery,
    deleteQuery,
    initSavedQueriesTable
} from "@/lib/intelligence/saved-queries"

// Ensure table exists on first request
let tableInitialized = false

async function ensureTable() {
    if (!tableInitialized) {
        try {
            await initSavedQueriesTable()
            tableInitialized = true
        } catch (e) {
            console.error("[saved-queries] Failed to init table:", e)
        }
    }
}

/**
 * GET /api/intelligence/saved-queries
 * Returns saved queries for the authenticated user
 */
export async function GET() {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canQuery = sessionUser.role === "admin"
        if (!canQuery) {
            const adminUser = await getAdminUser(sessionUser.fid)
            canQuery = hasPermission(adminUser, PERMISSIONS.INTELLIGENCE)
        }

        if (!canQuery) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        await ensureTable()
        const queries = await getSavedQueries(sessionUser.fid)

        return NextResponse.json({ success: true, queries })
    } catch (error) {
        console.error("[saved-queries] GET error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch queries" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/intelligence/saved-queries
 * Save a new query
 * Body: { name: string, question: string }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canQuery = sessionUser.role === "admin"
        if (!canQuery) {
            const adminUser = await getAdminUser(sessionUser.fid)
            canQuery = hasPermission(adminUser, PERMISSIONS.INTELLIGENCE)
        }

        if (!canQuery) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { name, question } = await request.json()

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 })
        }

        if (!question || typeof question !== "string" || question.trim().length === 0) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 })
        }

        await ensureTable()
        const saved = await saveQuery(sessionUser.fid, name.trim(), question.trim())

        return NextResponse.json({ success: true, query: saved })
    } catch (error) {
        console.error("[saved-queries] POST error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to save query" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/intelligence/saved-queries?id=123
 * Delete a saved query
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canQuery = sessionUser.role === "admin"
        if (!canQuery) {
            const adminUser = await getAdminUser(sessionUser.fid)
            canQuery = hasPermission(adminUser, PERMISSIONS.INTELLIGENCE)
        }

        if (!canQuery) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const idParam = searchParams.get("id")
        const id = idParam ? parseInt(idParam, 10) : NaN

        if (!Number.isFinite(id)) {
            return NextResponse.json({ error: "Invalid query ID" }, { status: 400 })
        }

        await ensureTable()
        const deleted = await deleteQuery(id, sessionUser.fid)

        if (!deleted) {
            return NextResponse.json({ error: "Query not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[saved-queries] DELETE error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete query" },
            { status: 500 }
        )
    }
}
