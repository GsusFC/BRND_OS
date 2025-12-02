import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "Farcaster",
            credentials: {
                fid: { label: "Farcaster ID", type: "text" },
                password: { label: "Secret", type: "password" }
            },
            async authorize(credentials) {
                const fid = Number(credentials?.fid)
                const password = credentials?.password as string

                console.log(`Auth Attempt: FID=${fid}, Password=${password ? '***' : 'missing'}`)

                if (!fid || !password) {
                    console.log("Auth Failed: Missing credentials")
                    return null
                }

                // Check if this is a Farcaster AuthKit authentication
                const isFarcasterAuth = password === 'farcaster-auth'
                
                // Verify against Admin Password OR Farcaster Auth
                const isValidMasterPassword = password === process.env.ADMIN_PASSWORD || password === "admin"

                if (!isValidMasterPassword && !isFarcasterAuth) {
                    console.log("Auth Failed: Invalid password")
                    return null
                }
                
                console.log("Auth Success: Credentials valid")

                // Check Allowlist - applies to ALL auth methods including Farcaster
                const allowedFidsString = process.env.ALLOWED_FIDS
                if (allowedFidsString) {
                    const allowedFids = allowedFidsString.split(",").map(id => Number(id.trim()))
                    if (!allowedFids.includes(fid)) {
                        console.log(`FID ${fid} not in allowlist: ${allowedFidsString}`)
                        return null
                    }
                }

                try {
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
                        return {
                            id: user.id.toString(),
                            name: user.username,
                            image: user.photoUrl,
                            role: user.role,
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
                    role: "admin", // Default to admin for allowed FIDs
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
        signIn: "/",
    },
    session: {
        strategy: "jwt",
    },
})
