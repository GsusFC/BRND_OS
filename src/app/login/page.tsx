import { signIn } from "@/auth"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import Image from "next/image"

export default async function LoginPage() {
    const session = await auth()
    if (session) redirect("/dashboard")

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-2xl">
                <div className="text-center flex flex-col items-center">
                    <Image
                        src="/logo.svg"
                        alt="BRND Logo"
                        width={140}
                        height={48}
                        className="h-12 w-auto mb-2"
                        priority
                    />
                    <p className="mt-2 text-zinc-500 font-mono text-sm">Admin Dashboard Access</p>
                </div>

                <div className="space-y-4">
                    <form
                        action={async () => {
                            "use server"
                            await signIn("google", { redirectTo: "/dashboard" })
                        }}
                    >
                        <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] font-mono uppercase tracking-wide"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase font-mono">
                            <span className="bg-surface px-2 text-zinc-500">Or continue with Farcaster</span>
                        </div>
                    </div>

                    <form
                        action={async (formData) => {
                            "use server"
                            await signIn("credentials", { ...Object.fromEntries(formData), redirectTo: "/dashboard" })
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <input
                                name="fid"
                                type="text"
                                placeholder="Farcaster ID"
                                required
                                className="w-full rounded-lg border border-input bg-[#212020] px-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white font-mono transition-colors"
                            />
                        </div>
                        <div>
                            <input
                                name="password"
                                type="password"
                                placeholder="Secret Key"
                                required
                                className="w-full rounded-lg border border-input bg-[#212020] px-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white font-mono transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-white transition-all hover:bg-surface-hover hover:border-zinc-600 font-mono uppercase tracking-wide"
                        >
                            Sign in with Credentials
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
