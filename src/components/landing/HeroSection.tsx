'use client'

import Image from "next/image"
import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit"
import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { useCallback } from "react"
import { useRouter } from "next/navigation"

interface HeroSectionProps {
    isAuthenticated?: boolean
}

export function HeroSection({ isAuthenticated = false }: HeroSectionProps) {
    const t = useTranslations('landing.hero')
    const router = useRouter()

    const handleSuccess = useCallback(async (res: StatusAPIResponse) => {
        if (res.fid) {
            const result = await signIn("credentials", {
                fid: res.fid,
                password: "farcaster-auth",
                redirect: false,
            })

            if (result && !result.error) {
                router.refresh()
                router.push("/dashboard")
            } else {
                console.error("Login failed:", result?.error)
            }
        }
    }, [router])

    return (
        <section className="relative min-h-[50vh] w-full overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/Landing.jpg"
                    alt="BRND Background"
                    fill
                    className="object-cover object-center"
                    priority
                    quality={90}
                />
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
                {/* Left Button - Go to Dashboard (Farcaster QR) */}
                <div className="relative h-[47px] w-[171px]">
                    {isAuthenticated ? (
                        <a 
                            href="/dashboard"
                            className="flex h-full w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-opacity hover:opacity-90"
                        >
                            {t('goToDashboard')}
                        </a>
                    ) : (
                        <>
                            {/* Custom label overlay */}
                            <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white text-sm font-semibold text-black">
                                {t('goToDashboard')}
                            </span>
                            {/* Hidden SignInButton that handles the click */}
                            <div className="absolute inset-0 opacity-0 [&>div]:h-full [&>div]:w-full [&_button]:h-full [&_button]:w-full">
                                <SignInButton onSuccess={handleSuccess} />
                            </div>
                        </>
                    )}
                </div>

                {/* Center Logo */}
                <div className="absolute left-1/2 top-6 -translate-x-1/2 md:top-6">
                    <Image
                        src="/logo.svg"
                        alt="BRND"
                        width={120}
                        height={40}
                        className="h-8 w-auto md:h-10"
                        priority
                    />
                </div>

                {/* Right Button - Open Miniapp */}
                <a
                    href="https://warpcast.com/~/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-[47px] w-[171px] items-center justify-center rounded-xl p-[1px] text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{
                        background: 'linear-gradient(135deg, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #ec4899, #a855f7, #6366f1, #3b82f6, #22c55e)'
                    }}
                >
                    <span className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/90 backdrop-blur-xl">
                        {t('openMiniapp')}
                    </span>
                </a>
            </header>

            {/* Hero Content */}
            <div className="relative z-10 flex min-h-[calc(50vh-100px)] flex-col items-center justify-center px-6">
                <h1 className="max-w-[1667px] text-center font-display text-4xl font-bold uppercase leading-[1.03] text-white md:text-6xl lg:text-7xl xl:text-[100px]">
                    {t('headline')}
                </h1>
            </div>
        </section>
    )
}
