import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser, updateAdminUser } from "@/lib/auth/admin-user-server"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"
import { getProfilesByFids } from "@/lib/farcaster-profile-cache"

interface RouteContext {
    params: Promise<{
        fid: string
    }>
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
    try {
        const { fid: fidParam } = await params
        const fid = Number(fidParam)

        if (!Number.isInteger(fid) || fid <= 0) {
            return NextResponse.json({ error: "Invalid FID" }, { status: 400 })
        }

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

        const existingAdminUser = await getAdminUser(fid)
        if (!existingAdminUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const profiles = await getProfilesByFids([fid])
        const profile = profiles[0]

        if (!profile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const updated = await updateAdminUser(fid, {
            username: profile.username,
            avatar: profile.imageUrl,
        })

        if (!updated) {
            return NextResponse.json({ error: "Failed to update admin user" }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            user: updated,
            farcaster: {
                fid: profile.fid,
                username: profile.username,
                displayName: profile.name,
                avatar: profile.imageUrl,
            },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error"
        console.error("Admin access sync error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
