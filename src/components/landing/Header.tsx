'use client'

import Image from "next/image"
import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit"
import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface HeaderProps {
    isAuthenticated?: boolean
}

export function Header({ isAuthenticated = false }: HeaderProps) {
    const t = useTranslations('landing.hero')
    const router = useRouter()
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const handleSuccess = useCallback(async (res: StatusAPIResponse) => {
        console.log("Farcaster Auth Success:", res)
        
        if (res.fid) {
            console.log("Attempting NextAuth signIn with FID:", res.fid)
            
            const result = await signIn("credentials", {
                fid: res.fid,
                password: "farcaster-auth",
                redirect: false,
            })

            console.log("NextAuth signIn result:", result)

            if (result && !result.error) {
                console.log("Login successful, redirecting to dashboard...")
                window.location.href = "/dashboard"
            } else {
                console.error("Login failed:", result?.error)
            }
        } else {
            console.error("No FID received from Farcaster")
        }
    }, [router])

    return (
        <header 
            className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 transition-all duration-300 md:px-12 ${
                isScrolled 
                    ? 'bg-black/80 py-3 backdrop-blur-md' 
                    : 'bg-transparent py-6'
            }`}
        >
            {/* Left Button - Go to Dashboard (Farcaster QR) */}
            <div className={`relative transition-all duration-300 ${
                isScrolled ? 'h-[38px] w-[140px]' : 'h-[47px] w-[171px]'
            }`}>
                {isAuthenticated ? (
                    <a 
                        href="/dashboard"
                        className={`flex h-full w-full items-center justify-center rounded-xl bg-white font-semibold text-black transition-all hover:opacity-90 ${
                            isScrolled ? 'text-xs' : 'text-sm'
                        }`}
                    >
                        {t('goToDashboard')}
                    </a>
                ) : (
                    <>
                        {/* Custom label overlay */}
                        <span className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white font-semibold text-black ${
                            isScrolled ? 'text-xs' : 'text-sm'
                        }`}>
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
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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

            {/* Right Button - Open Miniapp */}
            <a
                href="https://farcaster.xyz/brnd?launchFrameUrl=https%3A%2F%2Fbrnd.land%2F"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center rounded-xl p-[1px] font-semibold text-white transition-all hover:opacity-90 ${
                    isScrolled ? 'h-[38px] w-[140px] text-xs' : 'h-[47px] w-[171px] text-sm'
                }`}
                style={{
                    background: 'linear-gradient(135deg, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #ec4899, #a855f7, #6366f1, #3b82f6, #22c55e)'
                }}
            >
                <span className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/90 backdrop-blur-xl">
                    {t('openMiniapp')}
                </span>
            </a>
        </header>
    )
}
