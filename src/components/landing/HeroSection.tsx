'use client'

import Image from "next/image"
import { useTranslations } from "next-intl"
import { useState, useEffect } from "react"

export function HeroSection() {
    const t = useTranslations('landing.hero')
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <section className="relative min-h-[50vh] w-full overflow-hidden pt-24">
            {/* Background Image with Parallax */}
            <div className="absolute inset-0 z-0">
                <div 
                    className="absolute inset-0"
                    style={{
                        transform: `translateY(${scrollY * 0.5}px)`,
                        willChange: 'transform'
                    }}
                >
                    <Image
                        src="/BRND Hero 1.jpg"
                        alt="BRND Background"
                        fill
                        className="object-cover object-center"
                        priority
                        quality={90}
                    />
                </div>
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Hero Content */}
            <div className="relative z-10 flex min-h-[calc(50vh-100px)] flex-col items-center justify-center px-6">
                <h1 className="max-w-[1667px] text-center font-display text-4xl font-bold uppercase leading-[1.03] text-white md:text-6xl lg:text-7xl xl:text-[100px]">
                    {t('headline')}
                </h1>
            </div>
        </section>
    )
}
