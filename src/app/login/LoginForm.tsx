'use client'

import { useState, useCallback, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { SignInButton, useProfile } from '@farcaster/auth-kit'
import { Loader2, AlertCircle } from 'lucide-react'
import { GoogleLogo } from '@/components/icons/GoogleLogo'

type LoginFormProps = {
    googleEnabled: boolean
}

export default function LoginForm({ googleEnabled }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
                setError('Error al iniciar sesión. Intenta nuevamente.')
                setIsLoading(false)
            }
        }
    }, [profile])

    // Auto-login when authenticated with Farcaster
    useEffect(() => {
        if (isAuthenticated && profile && !error && !isLoading) {
            handleFarcasterSuccess()
        }
    }, [isAuthenticated, profile, error, isLoading, handleFarcasterSuccess])

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

    // If authenticated with Farcaster, show loading state or retry
    if (isAuthenticated && profile) {
        return (
            <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                        <div>
                            <p className="text-purple-400 font-mono text-sm font-medium">
                                {isLoading ? 'Verifying credential...' : `Signed in as @${profile.username}`}
                            </p>
                            <p className="text-zinc-400 font-mono text-xs mt-0.5">
                                FID: {profile.fid}
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-950/30 border border-red-800/30 text-red-400 text-sm font-mono animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <button
                    onClick={handleFarcasterSuccess}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 px-4 py-3 text-sm font-bold text-white transition-all font-mono uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Redirecting...</span>
                        </>
                    ) : (
                        'Retry Connection'
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-950/30 border border-red-800/30 text-red-400 text-sm font-mono animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Farcaster Sign In - Primary */}
            <div className="flex justify-center [&>div]:w-full [&_button]:w-full [&_button]:rounded-xl [&_button]:py-3.5 [&_button]:font-mono [&_button]:uppercase [&_button]:tracking-wide [&_button]:font-bold">
                <SignInButton />
            </div>

            {googleEnabled ? (
                <>
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
                        className="btn-brand-gradient flex w-full items-center justify-center gap-3 px-4 py-3 text-sm font-bold text-white font-mono uppercase tracking-wide disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <GoogleLogo className="h-5 w-5" />
                        )}
                        Continue with Google
                    </button>
                </>
            ) : null}
        </div>
    )
}
