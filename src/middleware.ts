import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export default async function middleware(req: NextRequest) {
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")
    if (!isOnDashboard) {
        return NextResponse.next()
    }

    const authSecret = process.env.AUTH_SECRET
    if (!authSecret) {
        throw new Error("AUTH_SECRET is not set")
    }

    let token = await getToken({ req, secret: authSecret })
    if (!token) {
        token = await getToken({ req, secret: authSecret, cookieName: "__Secure-authjs.session-token" })
    }
    if (!token) {
        token = await getToken({ req, secret: authSecret, cookieName: "authjs.session-token" })
    }
    if (!token) {
        console.warn("[middleware] No auth token for", req.nextUrl.pathname)
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    console.log("[middleware] Auth token ok for", req.nextUrl.pathname, {
        sub: token.sub,
        fid: (token as { fid?: number }).fid,
        role: (token as { role?: string }).role,
    })

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
