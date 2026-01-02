import LoginForm from "@/app/login/LoginForm"

export default function LoginPage() {
    const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
                <div className="rounded-2xl border border-border bg-surface p-6">
                    <h1 className="text-xl font-bold text-white font-display uppercase tracking-wide">
                        Sign in
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500 font-mono">
                        Connect with Farcaster (recommended) or Google
                    </p>

                    <div className="mt-6">
                        <LoginForm googleEnabled={googleEnabled} />
                    </div>
                </div>
            </div>
        </div>
    )
}
