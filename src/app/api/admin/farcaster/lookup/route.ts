import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"
import { fetchUserByUsernameCached, getProfilesByFids } from "@/lib/farcaster-profile-cache"

const normalizeQuery = (raw: string): string => raw.trim().replace(/^@+/, "")

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
            canLookup = hasPermission(requester, PERMISSIONS.ACCESS_CONTROL)
        }

        if (!canLookup) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const qRaw = searchParams.get("q")

        if (!qRaw || typeof qRaw !== "string") {
            return NextResponse.json({ error: "Query is required" }, { status: 400 })
        }

        const q = normalizeQuery(qRaw)

        if (!q) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 })
        }

        const isFid = /^\d+$/.test(q)

        if (isFid) {
            const fid = Number(q)
            if (!Number.isInteger(fid) || fid <= 0) {
                return NextResponse.json({ error: "Invalid FID" }, { status: 400 })
            }

            const profiles = await getProfilesByFids([fid])
            const profile = profiles[0]

            if (!profile) {
                return NextResponse.json({ error: "User not found" }, { status: 404 })
            }

            return NextResponse.json({
                success: true,
                user: {
                    fid: profile.fid,
                    username: profile.username,
                    displayName: profile.name,
                    avatar: profile.imageUrl,
                    bio: profile.description,
                },
            })
        }

        const result = await fetchUserByUsernameCached(q)

        if ("error" in result) {
            const lowered = result.error.toLowerCase()
            const isNotFound = lowered.includes("not found")
            const isInvalid = lowered.includes("invalid username format")
            const status = isNotFound ? 404 : isInvalid ? 400 : 502
            return NextResponse.json({ error: result.error }, { status })
        }

        return NextResponse.json({
            success: true,
            user: {
                fid: result.data.fid,
                username: result.data.username,
                displayName: result.data.name,
                avatar: result.data.imageUrl,
                bio: result.data.description,
            },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error"
        console.error("Admin Farcaster lookup error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
