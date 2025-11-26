import { redirect } from "next/navigation"
import { auth } from "@/auth"
import Image from "next/image"
import LoginForm from "./LoginForm"

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

                <LoginForm />
            </div>
        </div>
    )
}
