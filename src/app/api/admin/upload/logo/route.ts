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

        const pinataJwt = process.env.PINATA_JWT
        if (!pinataJwt) {
            return NextResponse.json({ error: "Server misconfiguration: PINATA_JWT is not set." }, { status: 500 })
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
        const pinataForm = new FormData()
        pinataForm.append("file", new Blob([buffer], { type: file.type }), file.name)
        pinataForm.append("pinataMetadata", JSON.stringify({ name: file.name }))

        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${pinataJwt}`,
            },
            body: pinataForm,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
            return NextResponse.json(
                { error: data?.error?.details || data?.error || "Pinata upload failed." },
                { status: 502 }
            )
        }

        const ipfsHash = data?.IpfsHash
        if (!ipfsHash) {
            return NextResponse.json({ error: "Pinata did not return a hash." }, { status: 502 })
        }

        return NextResponse.json({
            ipfsHash,
            ipfsUrl: `ipfs://${ipfsHash}`,
            httpUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        })
    } catch (error) {
        console.error("Upload logo error:", error)
        return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 })
    }
}
