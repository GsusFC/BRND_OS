'use client'

import Image from "next/image"
import { useEffect, useState } from "react"

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header
            className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-center px-6 transition-all duration-300 ${
                isScrolled
                    ? 'bg-black/80 py-3 backdrop-blur-md'
                    : 'bg-transparent py-6'
            }`}
        >
            {/* Center Logo */}
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
        </header>
    )
}
