import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export default async function middleware(req: NextRequest) {
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")
    if (!isOnDashboard) {
        return NextResponse.next()
    }

    const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    if (!authSecret) {
        throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not set")
    }

    let token = await getToken({ req, secret: authSecret })
    if (!token) {
        token = await getToken({ req, secret: authSecret, cookieName: "__Secure-authjs.session-token" })
    }
    if (!token) {
        token = await getToken({ req, secret: authSecret, cookieName: "authjs.session-token" })
    }
    if (!token) {
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
