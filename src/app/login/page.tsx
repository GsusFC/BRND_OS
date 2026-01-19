import { auth } from "@/auth"
import LoginForm from "@/app/login/LoginForm"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function LoginPage() {
    const session = await auth()
    if (session?.user) redirect("/dashboard")

    const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    const tLanding = await getTranslations("landing")

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
                <div className="rounded-2xl border border-border bg-surface p-6">
                    <h1 className="text-xl font-bold text-white font-display uppercase tracking-wide">
                        {tLanding("login.title")}
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500 font-mono">
                        {tLanding("login.subtitle")}
                    </p>

                    <div className="mt-6">
                        <LoginForm googleEnabled={googleEnabled} />
                    </div>
                </div>
            </div>
        </div>
    )
}
