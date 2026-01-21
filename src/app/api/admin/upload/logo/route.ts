import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 1024 * 1024

export async function POST(request: Request) {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let canUpload = sessionUser.role === "admin"
        if (!canUpload) {
            const adminUser = await getAdminUser(sessionUser.fid)
            canUpload = hasPermission(adminUser, PERMISSIONS.APPLICATIONS)
        }

        if (!canUpload) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
        const cloudflareToken = process.env.CLOUDFLARE_IMAGES_API_KEY
        if (!cloudflareAccountId || !cloudflareToken) {
            return NextResponse.json({ error: "Server misconfiguration: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_IMAGES_API_KEY is not set." }, { status: 500 })
        }

        const form = await request.formData()
        const file = form.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing image file." }, { status: 400 })
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 })
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: "Image exceeds 1MB limit after compression." }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadForm = new FormData()
        uploadForm.append("file", new Blob([buffer], { type: file.type }), file.name)

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v1`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${cloudflareToken}`,
            },
            body: uploadForm,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok || data?.success === false) {
            const message = data?.errors?.[0]?.message || data?.error || "Cloudflare Images upload failed."
            return NextResponse.json({ error: message }, { status: 502 })
        }

        const variants = data?.result?.variants
        const imageUrl = Array.isArray(variants) ? variants[0] : null
        if (!imageUrl) {
            return NextResponse.json({ error: "Cloudflare Images did not return a delivery URL." }, { status: 502 })
        }

        return NextResponse.json({
            imageUrl,
        })
    } catch (error) {
        console.error("Upload logo error:", error)
        return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 })
    }
}
