import { NextRequest, NextResponse } from "next/server"
import { getAllAdminUsers, getAdminUser, createAdminUser } from "@/lib/auth/admin-user-server"
import { auth } from "@/auth"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

// GET /api/admin/access - Get all admin users
export async function GET() {
    try {
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

        const users = await getAllAdminUsers()
        return NextResponse.json({ users })
    } catch (error) {
        console.error("Error fetching admin users:", error)
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        )
    }
}

// POST /api/admin/access - Add new admin user
export async function POST(request: NextRequest) {
    try {
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
        const { fid, username, role, avatar, permissions } = body

        if (!fid || !username || !role) {
            return NextResponse.json(
                { error: "FID, username, and role are required" },
                { status: 400 }
            )
        }

        // Check if user already exists
        const existingUser = await getAdminUser(parseInt(fid))
        if (existingUser) {
            return NextResponse.json(
                { error: "User already has admin access" },
                { status: 400 }
            )
        }

        const user = await createAdminUser({
            fid: parseInt(fid),
            username,
            role,
            avatar,
            permissions
        })

        if (!user) {
            return NextResponse.json(
                { error: "Failed to create user" },
                { status: 500 }
            )
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error("Error creating admin user:", error)
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        )
    }
}