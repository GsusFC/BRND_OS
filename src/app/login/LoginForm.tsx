'use client'

import { useState, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { SignInButton, useProfile } from '@farcaster/auth-kit'
import { Loader2 } from 'lucide-react'

export default function LoginForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const { isAuthenticated, profile } = useProfile()

    // Handle successful Farcaster sign in
    const handleFarcasterSuccess = useCallback(async () => {
        if (profile?.fid) {
            setIsLoading(true)
            try {
                // Sign in with NextAuth using the Farcaster FID
                await signIn('credentials', {
                    fid: profile.fid.toString(),
                    password: 'farcaster-auth', // Special password for Farcaster auth
                    callbackUrl: '/dashboard'
                })
            } catch {
                setError('Error al iniciar sesión')
                setIsLoading(false)
            }
        }
    }, [profile, router])

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

    // If authenticated with Farcaster, show continue button
    if (isAuthenticated && profile) {
        return (
            <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                        <div>
                            <p className="text-purple-400 font-mono text-sm font-medium">
                                Signed in as @{profile.username}
                            </p>
                            <p className="text-zinc-400 font-mono text-xs mt-0.5">
                                FID: {profile.fid}
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleFarcasterSuccess}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 px-4 py-3 text-sm font-bold text-white transition-all font-mono uppercase tracking-wide disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                        'Continue to Dashboard'
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm font-mono">
                    {error}
                </div>
            )}

            {/* Farcaster Sign In - Primary */}
            <div className="flex justify-center [&>div]:w-full [&_button]:w-full [&_button]:rounded-xl [&_button]:py-3.5 [&_button]:font-mono [&_button]:uppercase [&_button]:tracking-wide [&_button]:font-bold">
                <SignInButton />
            </div>

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
        </div>
    )
}
