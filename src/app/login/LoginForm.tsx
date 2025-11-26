'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Wallet, Loader2 } from 'lucide-react'

export default function LoginForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleGoogleSignIn = async () => {
        setIsLoading(true)
        setError(null)
        try {
            await signIn('google', { callbackUrl: '/dashboard' })
        } catch {
            setError('Error al iniciar sesión con Google')
            setIsLoading(false)
        }
    }

    const handleCredentialsSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const fid = formData.get('fid') as string
        const password = formData.get('password') as string

        try {
            const result = await signIn('credentials', {
                fid,
                password,
                redirect: false
            })

            if (result?.error) {
                setError('Credenciales inválidas')
                setIsLoading(false)
            } else {
                router.push('/dashboard')
            }
        } catch {
            setError('Error al iniciar sesión')
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm font-mono">
                    {error}
                </div>
            )}

            {/* Wallet Connect - Coming Soon */}
            <button
                disabled
                className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3.5 text-sm font-bold text-zinc-500 font-mono uppercase tracking-wide cursor-not-allowed"
            >
                <Wallet className="w-5 h-5" />
                Connect Wallet (Coming Soon)
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase font-mono">
                    <span className="bg-surface px-2 text-zinc-500">Or</span>
                </div>
            </div>

            {/* Google Sign In */}
            <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] font-mono uppercase tracking-wide disabled:opacity-50"
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
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
                )}
                Continue with Google
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase font-mono">
                    <span className="bg-surface px-2 text-zinc-500">Farcaster</span>
                </div>
            </div>

            {/* Farcaster Credentials */}
            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
                <div>
                    <input
                        name="fid"
                        type="text"
                        placeholder="Farcaster ID"
                        required
                        disabled={isLoading}
                        className="w-full rounded-lg border border-input bg-[#212020] px-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white font-mono transition-colors disabled:opacity-50"
                    />
                </div>
                <div>
                    <input
                        name="password"
                        type="password"
                        placeholder="Secret Key"
                        required
                        disabled={isLoading}
                        className="w-full rounded-lg border border-input bg-[#212020] px-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white font-mono transition-colors disabled:opacity-50"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-white transition-all hover:bg-surface-hover hover:border-zinc-600 font-mono uppercase tracking-wide disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                        'Sign in with Credentials'
                    )}
                </button>
            </form>
        </div>
    )
}
