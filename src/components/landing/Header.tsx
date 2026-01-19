'use client'

import Image from "next/image"
import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit"
import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { LayoutDashboard, Rocket } from "lucide-react"

interface HeaderProps {
    isAuthenticated?: boolean
    rightSlot?: ReactNode
    showActionsOnMobile?: boolean
}

export function Header({ isAuthenticated = false, rightSlot, showActionsOnMobile = false }: HeaderProps) {
    const t = useTranslations('landing.hero')
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

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
        <header
            className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-center px-6 transition-all duration-300 md:justify-between md:px-12 ${
                isScrolled
                    ? 'bg-black/80 py-3 backdrop-blur-md'
                    : 'bg-transparent py-6'
            }`}
        >
            {/* Left Button - Go to Dashboard (Desktop only) */}
            <div className={`relative hidden transition-all duration-300 md:block ${
                isScrolled ? 'h-10 w-[160px]' : 'h-11 w-[180px]'
            }`}>
                {isAuthenticated ? (
                    <a
                        href="/dashboard"
                        className="flex h-full w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-white/90"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>{t('goToDashboard')}</span>
                    </a>
                ) : (
                    <>
                        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black">
                            <LayoutDashboard className="h-4 w-4" />
                            <span>{t('goToDashboard')}</span>
                        </span>
                        <div className="absolute inset-0 opacity-0 [&>div]:h-full [&>div]:w-full [&_button]:h-full [&_button]:w-full">
                            <SignInButton onSuccess={handleSuccess} />
                        </div>
                    </>
                )}
            </div>

            {/* Center Logo */}
            <div className="md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                <Image
                    src="/logo.svg"
                    alt="BRND"
                    width={120}
                    height={40}
                    className={`w-auto transition-all duration-300 ${
                        isScrolled ? 'h-6 md:h-7' : 'h-8 md:h-10'
                    }`}
                    priority
                />
            </div>

            {/* Right Button - Open Miniapp (Desktop only) */}
            {rightSlot ? (
                <div
                    className={
                        showActionsOnMobile
                            ? 'absolute right-6 top-1/2 -translate-y-1/2 md:static md:translate-y-0'
                            : 'hidden md:block'
                    }
                >
                    {rightSlot}
                </div>
            ) : (
                <a
                    href="https://farcaster.xyz/brnd?launchFrameUrl=https%3A%2F%2Fbrnd.land%2F"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hidden items-center justify-center rounded-xl p-[1px] text-sm font-semibold text-white transition-all hover:opacity-90 md:flex ${
                        isScrolled ? 'h-10 w-[160px]' : 'h-11 w-[180px]'
                    }`}
                    style={{
                        background: 'linear-gradient(135deg, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #ec4899, #a855f7, #6366f1, #3b82f6, #22c55e)'
                    }}
                >
                    <span className="flex h-full w-full items-center justify-center gap-2 rounded-[11px] bg-black/90">
                        <Rocket className="h-4 w-4" />
                        <span>{t('openMiniapp')}</span>
                    </span>
                </a>
            )}
        </header>
    )
}
