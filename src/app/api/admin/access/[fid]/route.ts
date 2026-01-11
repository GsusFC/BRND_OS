import { NextRequest, NextResponse } from "next/server"
import { getAdminUser, updateAdminUser, deleteAdminUser } from "@/lib/auth/admin-user-server"
import { auth } from "@/auth"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

interface RouteContext {
    params: Promise<{
        fid: string
    }>
}

// GET /api/admin/access/[fid] - Get specific admin user
export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { fid: fidParam } = await params
        const fid = parseInt(fidParam)

        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canReadUser = sessionUser.role === "admin" || sessionUser.fid === fid
        if (!canReadUser) {
            const requester = await getAdminUser(sessionUser.fid)
            canReadUser = hasPermission(requester, PERMISSIONS.ACCESS_CONTROL)
        }

        if (!canReadUser) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const user = await getAdminUser(fid)

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error("Error fetching admin user:", error)
        return NextResponse.json(
            { error: "Failed to fetch user" },
            { status: 500 }
        )
    }
}

// PATCH /api/admin/access/[fid] - Update admin user permissions
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const { fid: fidParam } = await params
        const fid = parseInt(fidParam)

        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canManageAccess = sessionUser.role === "admin"
        if (!canManageAccess) {
            const requester = await getAdminUser(sessionUser.fid)
            canManageAccess = hasPermission(requester, PERMISSIONS.ACCESS_CONTROL)
        }

        if (!canManageAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { role, permissions, is_active } = body

        const user = await updateAdminUser(fid, {
            role,
            permissions,
            is_active
        })

        if (!user) {
            return NextResponse.json(
                { error: "Failed to update user" },
                { status: 500 }
            )
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error("Error updating admin user:", error)
        return NextResponse.json(
            { error: "Failed to update user" },
            { status: 500 }
        )
    }
}

// DELETE /api/admin/access/[fid] - Remove admin access
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const { fid: fidParam } = await params
        const fid = parseInt(fidParam)

        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canManageAccess = sessionUser.role === "admin"
        if (!canManageAccess) {
            const requester = await getAdminUser(sessionUser.fid)
            canManageAccess = hasPermission(requester, PERMISSIONS.ACCESS_CONTROL)
        }

        if (!canManageAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const success = await deleteAdminUser(fid)
        
        if (!success) {
            return NextResponse.json(
                { error: "Failed to delete user" },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting admin user:", error)
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        )
    }
}