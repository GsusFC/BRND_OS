'use client'

import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit"
import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { useCallback } from "react"
import { LayoutDashboard, Rocket } from "lucide-react"

interface StickyBottomBarProps {
    isAuthenticated?: boolean
}

export function StickyBottomBar({ isAuthenticated = false }: StickyBottomBarProps) {
    const t = useTranslations('landing.hero')

    const handleSuccess = useCallback(async (res: StatusAPIResponse) => {
        if (!res.fid || !res.message || !res.signature || !res.nonce) {
            return
        }

        if (!res.signature.startsWith("0x")) {
            return
        }

        const result = await signIn("credentials", {
            fid: res.fid,
            message: res.message,
            signature: res.signature,
            nonce: res.nonce,
            redirect: false,
        })

        if (result && !result.error) {
            window.location.href = "/dashboard"
        }
    }, [])

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 sm:px-6 sm:pb-6 md:hidden">
            {/* Button container */}
            <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 backdrop-blur-xl sm:gap-4 sm:px-6">
                {/* Dashboard Button */}
                <div className="relative h-10 flex-1 sm:h-11">
                    {isAuthenticated ? (
                        <a
                            href="/dashboard"
                            className="flex h-full w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black transition-all hover:bg-white/90 sm:text-sm"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span>{t('goToDashboard')}</span>
                        </a>
                    ) : (
                        <>
                            {/* Custom label overlay */}
                            <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black sm:text-sm">
                                <LayoutDashboard className="h-4 w-4" />
                                <span>{t('goToDashboard')}</span>
                            </span>
                            {/* Hidden SignInButton that handles the click */}
                            <div className="absolute inset-0 opacity-0 [&>div]:h-full [&>div]:w-full [&_button]:h-full [&_button]:w-full">
                                <SignInButton onSuccess={handleSuccess} />
                            </div>
                        </>
                    )}
                </div>

                {/* Miniapp Button */}
                <a
                    href="https://farcaster.xyz/brnd?launchFrameUrl=https%3A%2F%2Fbrnd.land%2F"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl p-[1px] text-xs font-semibold text-white transition-all hover:opacity-90 sm:h-11 sm:text-sm"
                    style={{
                        background: 'linear-gradient(135deg, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #ec4899, #a855f7, #6366f1, #3b82f6, #22c55e)'
                    }}
                >
                    <span className="flex h-full w-full items-center justify-center gap-2 rounded-[11px] bg-black/90 px-4">
                        <Rocket className="h-4 w-4" />
                        <span>{t('openMiniapp')}</span>
                    </span>
                </a>
            </div>
        </div>
    )
}
