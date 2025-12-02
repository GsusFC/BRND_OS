import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")

    console.log(`Middleware: Path=${req.nextUrl.pathname}, IsLoggedIn=${isLoggedIn}`)

    if (isOnDashboard && !isLoggedIn) {
        console.log("Middleware: Redirecting to root from dashboard (Not logged in)")
        return NextResponse.redirect(new URL("/", req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
