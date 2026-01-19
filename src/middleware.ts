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

    const token = await getToken({ req, secret: authSecret })
    if (!token) {
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
