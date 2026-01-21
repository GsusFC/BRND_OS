import { NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { getRequestOrigin } from "@/lib/request-utils"
import {
    WALLET_SIGNATURE_TTL_SECONDS,
    buildWalletNonceKey,
    normalizeWalletAddress,
} from "@/lib/wallet-signature"

type WalletNonceResponse = {
    nonce: string
    expiresAt: number
    origin: string
}

type WalletNonceRequest = {
    address: string
}

type WalletNonceRecord = {
    origin: string
    expiresAt: number
}

export async function POST(request: NextRequest) {
    const origin = getRequestOrigin(request.headers)
    if (!origin) {
        return NextResponse.json({ error: "Missing origin." }, { status: 400 })
    }

    let body: WalletNonceRequest
    try {
        body = (await request.json()) as WalletNonceRequest
    } catch {
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
    }

    if (!body?.address || typeof body.address !== "string") {
        return NextResponse.json({ error: "Wallet address is required." }, { status: 400 })
    }

    let normalizedAddress: string
    try {
        normalizedAddress = normalizeWalletAddress(body.address)
    } catch {
        return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 })
    }

    const nonce = crypto.randomUUID()
    const expiresAt = Date.now() + WALLET_SIGNATURE_TTL_SECONDS * 1000

    const key = buildWalletNonceKey(normalizedAddress, nonce)
    const record: WalletNonceRecord = { origin, expiresAt }

    try {
        await redis.setex(key, WALLET_SIGNATURE_TTL_SECONDS, record)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown redis error."
        console.error("[wallet/nonce] redis.setex failed:", message)
        return NextResponse.json({ error: `Redis error: ${message}` }, { status: 503 })
    }

    const response: WalletNonceResponse = {
        nonce,
        expiresAt,
        origin,
    }

    return NextResponse.json(response)
}
