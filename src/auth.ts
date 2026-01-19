import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { createAppClient, viemConnector } from "@farcaster/auth-client"
import { createRateLimiter } from "@/lib/rate-limit"
import { redis } from "@/lib/redis"
import { getClientIpFromHeaders } from "@/lib/request-utils"

const FARCASTER_RPC_URL = "https://mainnet.optimism.io"
const FARCASTER_RELAY_URL = "https://relay.farcaster.xyz"

const loginRateLimiter = createRateLimiter(redis, {
    keyPrefix: "brnd:ratelimit:login",
    windowSeconds: 60,
    maxRequests: 8,
})

const farcasterClient = createAppClient({
    relay: FARCASTER_RELAY_URL,
    ethereum: viemConnector({ rpcUrl: FARCASTER_RPC_URL }),
})

const getFarcasterDomain = (): string => {
    const authUrl = process.env.AUTH_URL
    if (!authUrl) {
        throw new Error("AUTH_URL is required for Farcaster auth")
    }

    return new URL(authUrl).host
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "Farcaster",
            credentials: {
                fid: { label: "Farcaster ID", type: "text" },
                password: { label: "Secret", type: "password" },
                message: { label: "SIWE Message", type: "text" },
                signature: { label: "SIWE Signature", type: "text" },
                nonce: { label: "SIWE Nonce", type: "text" },
            },
            async authorize(credentials, request) {
                const requestHeaders = request?.headers
                const clientIp = requestHeaders ? getClientIpFromHeaders(requestHeaders) : null
                const isDevelopment = process.env.NODE_ENV === "development"

                if (!isDevelopment) {
                    if (!clientIp) {
                        console.log("Auth Failed: Missing client IP")
                        return null
                    }

                    const allowed = await loginRateLimiter(clientIp)
                    if (!allowed) {
                        console.log("Auth Failed: Rate limit exceeded")
                        return null
                    }
                }

                const fidInput = credentials?.fid ? Number(credentials.fid) : undefined
                const password = credentials?.password ? String(credentials.password) : undefined
                const message = credentials?.message ? String(credentials.message) : undefined
                const signature = credentials?.signature ? String(credentials.signature) : undefined
                const nonce = credentials?.nonce ? String(credentials.nonce) : undefined

                const usesSiwe = Boolean(message && signature && nonce)
                const usesPassword = Boolean(password)

                if (!usesSiwe && !usesPassword) {
                    console.log("Auth Failed: Missing credentials")
                    return null
                }

                if (usesSiwe && usesPassword) {
                    console.log("Auth Failed: Multiple auth methods")
                    return null
                }

                let fid: number | null = null
                let isValidMasterPassword = false

                if (usesPassword) {
                    if (!fidInput) {
                        console.log("Auth Failed: Missing FID")
                        return null
                    }

                    const adminPassword = process.env.ADMIN_PASSWORD
                    if (!adminPassword) {
                        throw new Error("ADMIN_PASSWORD is required for password auth")
                    }

                    isValidMasterPassword = password === adminPassword
                    if (!isValidMasterPassword) {
                        console.log("Auth Failed: Invalid password")
                        return null
                    }

                    fid = fidInput
                }

                if (usesSiwe) {
                    if (!message || !nonce || !signature) {
                        console.log("Auth Failed: Missing SIWE payload")
                        return null
                    }

                    if (!signature.startsWith("0x")) {
                        console.log("Auth Failed: Invalid signature")
                        return null
                    }

                    const domain = getFarcasterDomain()
                    const verification = await farcasterClient.verifySignInMessage({
                        nonce,
                        domain,
                        message,
                        signature: signature as `0x${string}`,
                    })

                    if (verification.isError || !verification.success) {
                        console.log("Auth Failed: Invalid SIWE verification")
                        return null
                    }

                    const verifiedFid = Number(verification.fid)
                    if (!Number.isFinite(verifiedFid)) {
                        console.log("Auth Failed: Invalid verified FID")
                        return null
                    }

                    if (fidInput && fidInput !== verifiedFid) {
                        console.log("Auth Failed: FID mismatch")
                        return null
                    }

                    fid = verifiedFid
                }

                if (fid === null) {
                    console.log("Auth Failed: Missing FID")
                    return null
                }

                console.log(`Auth Success: FID=${fid} Method=${usesSiwe ? "siwe" : "password"}`)

                // Check Allowlist - applies to ALL auth methods including Farcaster
                const allowedFidsString = process.env.ALLOWED_FIDS
                const allowedFids = allowedFidsString
                    ? allowedFidsString.split(",").map(id => Number(id.trim())).filter(Number.isFinite)
                    : null

                const isAllowedFid = allowedFids ? allowedFids.includes(fid) : false
                if (allowedFidsString) {
                    if (!isAllowedFid) {
                        console.log(`FID ${fid} not in allowlist: ${allowedFidsString}`)
                        return null
                    }
                }

                const shouldBeAdmin = isValidMasterPassword || isAllowedFid

                try {
                    const { default: prisma } = await import("@/lib/prisma")

                    // Try to find real user in DB
                    // Select only fields that we know exist to avoid schema mismatch errors
                    const user = await prisma.user.findUnique({
                        where: { fid: fid },
                        select: {
                            id: true,
                            fid: true,
                            username: true,
                            photoUrl: true,
                            role: true
                        }
                    })

                    if (user) {
                        console.log(`Auth: Found user in DB: ${user.username}`)

                        const role = shouldBeAdmin ? "admin" : user.role
                        return {
                            id: user.id.toString(),
                            name: user.username,
                            image: user.photoUrl,
                            role,
                            fid: user.fid
                        }
                    }

                    // User not found in DB, fall through to default return
                } catch (e) {
                    console.error("Database error during auth (proceeding with default user):", e)
                    // Do NOT return null here. If we validated the password/allowlist, 
                    // we should allow the user in even if the DB read fails.
                }

                console.log("Auth: User not in DB, returning default session")
                // Allow login even if user is not in DB yet or DB read failed (as Admin/Dev)
                return {
                    id: fid.toString(),
                    name: `Farcaster User ${fid}`,
                    image: null,
                    role: shouldBeAdmin ? "admin" : "user",
                    fid: fid
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role
                token.fid = user.fid
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string
                session.user.fid = token.fid as number
                session.user.id = token.sub as string
            }
            return session
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
})
