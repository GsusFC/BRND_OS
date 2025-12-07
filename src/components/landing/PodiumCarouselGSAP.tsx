'use client'

import Image from "next/image"
import { useEffect, useState, useCallback, useRef } from "react"
import gsap from "gsap"

interface Brand {
    id: number
    name: string
    imageUrl: string | null
}

interface Podium {
    id: string
    date: Date
    username: string
    userPhoto: string | null
    brand1: Brand | null
    brand2: Brand | null
    brand3: Brand | null
}

const POLLING_INTERVAL = 10000 // 10 segundos
const CAROUSEL_INTERVAL = 6000 // 6 segundos entre rotaciones
const VISIBLE_CARDS = 4 // Número de cards visibles en el stack

interface PodiumCarouselProps {
    initialPodiums?: Podium[]
}

export function PodiumCarouselGSAP({ initialPodiums = [] }: PodiumCarouselProps) {
    const [podiums, setPodiums] = useState<Podium[]>(initialPodiums)
    const [isLoading, setIsLoading] = useState(initialPodiums.length === 0)
    const sliderRef = useRef<HTMLDivElement>(null)
    const isAnimatingRef = useRef(false)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const fetchPodiums = useCallback(async () => {
        try {
            const res = await fetch('/api/landing/podiums')
            if (res.ok) {
                const data = await res.json()
                setPodiums(data.podiums)
            }
        } catch (error) {
            console.error('Error fetching podiums:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Inicializar posiciones de las cards
    const initializeCards = useCallback(() => {
        if (!sliderRef.current) return
        const cards = Array.from(sliderRef.current.querySelectorAll('.podium-card'))
        
        gsap.to(cards, {
            y: (i: number) => `${-15 + 15 * i}%`,
            z: (i: number) => 15 * i,
            opacity: 1,
            duration: 1,
            ease: "power3.inOut",
            stagger: -0.1
        })
    }, [])

    // Rotar al siguiente podium
    const rotateCards = useCallback(() => {
        if (!sliderRef.current || isAnimatingRef.current) return
        
        isAnimatingRef.current = true
        const slider = sliderRef.current
        const cards = Array.from(slider.querySelectorAll('.podium-card'))
        
        if (cards.length < 2) {
            isAnimatingRef.current = false
            return
        }

        const lastCard = cards[cards.length - 1] as HTMLElement

        // Animar la última card (la del frente) hacia abajo
        gsap.to(lastCard, {
            y: "+=150%",
            opacity: 0,
            duration: 1,
            ease: "power3.inOut",
            onComplete: () => {
                // Ocultar completamente antes de mover
                gsap.set(lastCard, { visibility: 'hidden', opacity: 0 })
                // Mover la card al principio del DOM
                slider.prepend(lastCard)
                // Reinicializar posiciones (esto restaurará opacity: 1)
                initializeCards()
                // Hacer visible de nuevo después de posicionar
                gsap.set(lastCard, { visibility: 'visible' })
                
                setTimeout(() => {
                    isAnimatingRef.current = false
                }, 500)
            }
        })
    }, [initializeCards])

    // Fetch inicial y polling
    useEffect(() => {
        if (initialPodiums.length === 0) {
            fetchPodiums()
        }
        const pollInterval = setInterval(fetchPodiums, POLLING_INTERVAL)
        return () => clearInterval(pollInterval)
    }, [fetchPodiums, initialPodiums.length])

    // Inicializar cards cuando se cargan los podiums
    useEffect(() => {
        if (podiums.length > 0) {
            // Pequeño delay para asegurar que el DOM está listo
            setTimeout(initializeCards, 100)
        }
    }, [podiums, initializeCards])

    // Auto-rotate
    useEffect(() => {
        if (podiums.length <= 1) return

        intervalRef.current = setInterval(rotateCards, CAROUSEL_INTERVAL)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [podiums.length, rotateCards])

    if (isLoading) {
        return (
            <section className="relative py-32 px-6 overflow-hidden bg-zinc-900">
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
            </section>
        )
    }

    if (podiums.length === 0) {
        return null
    }

    return (
        <section className="relative z-20 py-16 overflow-hidden">
            <div className="w-full">
                <h2 className="text-center text-2xl font-bold text-white mb-8 font-display uppercase px-6">
                    Live Podiums (GSAP)
                </h2>
                
                {/* Slider container - full width */}
                <div
                    ref={sliderRef}
                    className="relative w-full h-[500px] sm:h-[600px] md:h-[750px] overflow-hidden"
                    style={{ 
                        perspective: '300px',
                        perspectiveOrigin: '50% 50%'
                    }}
                >
                    {/* Gradiente superior para ocultar cards que suben */}
                    <div 
                        className="absolute top-0 left-0 right-0 h-[200px] z-50 pointer-events-none"
                        style={{
                            background: 'linear-gradient(to bottom, rgb(0,0,0) 0%, rgba(0,0,0,0) 100%)'
                        }}
                    />
                    {/* Gradiente inferior para ocultar cards que bajan */}
                    <div 
                        className="absolute bottom-0 left-0 right-0 h-[200px] z-50 pointer-events-none"
                        style={{
                            background: 'linear-gradient(to top, rgb(0,0,0) 0%, rgba(0,0,0,0) 100%)'
                        }}
                    />
                    {podiums.slice(0, VISIBLE_CARDS).map((podium, index, array) => (
                        <PodiumCardGSAP 
                            key={podium.id} 
                            podium={podium} 
                            priority={index === array.length - 1} 
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

function PodiumCardGSAP({ podium, priority = false }: { podium: Podium, priority?: boolean }) {
    return (
        <div
            className="podium-card absolute top-[35%] left-1/2 h-[350px] sm:h-[400px] md:h-[450px] w-[calc(100vw-3rem)] sm:w-[400px] md:w-[500px] lg:w-[600px] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10"
            style={{
                transform: 'translate3d(-50%, -50%, 0)',
                opacity: 0,
            }}
        >
            {/* Header con usuario y fecha */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-3">
                    {podium.userPhoto ? (
                        <Image
                            src={podium.userPhoto}
                            width={40}
                            height={40}
                            alt={podium.username}
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
                            priority={priority}
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">
                            {podium.username.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="text-base font-semibold text-white">
                        @{podium.username}
                    </span>
                </div>
                <span className="text-sm text-zinc-500 font-mono">
                    {new Date(podium.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                    })}
                </span>
            </div>

            {/* Podium Visual */}
            <div className="flex items-end justify-center gap-2 sm:gap-3 flex-1 px-3 sm:px-6 pb-4 sm:pb-6 pt-2">
                {/* 2nd Place */}
                {podium.brand2 && (
                    <div className="flex flex-col items-center">
                        <div
                            className="w-[70px] sm:w-[90px] md:w-[110px] h-[140px] sm:h-[180px] md:h-[220px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-2">
                                <div className="w-[60px] sm:w-[80px] md:w-[100px] h-[60px] sm:h-[80px] md:h-[100px] rounded-lg overflow-hidden flex-shrink-0">
                                    {podium.brand2.imageUrl ? (
                                        <Image
                                            src={podium.brand2.imageUrl}
                                            width={100}
                                            height={100}
                                            alt={podium.brand2.name}
                                            className="w-full h-full object-contain"
                                            priority={priority}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-2xl text-zinc-600">
                                            {podium.brand2.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-2xl sm:text-4xl md:text-5xl font-black font-display mt-auto bg-gradient-to-b from-gray-200 to-gray-400 bg-clip-text text-transparent">
                                    2
                                </span>
                                <span className="text-[10px] md:text-xs text-zinc-400 font-medium text-center truncate w-full px-1">
                                    {podium.brand2.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1st Place */}
                {podium.brand1 && (
                    <div className="flex flex-col items-center">
                        <div
                            className="w-[70px] sm:w-[90px] md:w-[110px] h-[170px] sm:h-[220px] md:h-[280px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-2">
                                <div className="w-[60px] sm:w-[80px] md:w-[100px] h-[60px] sm:h-[80px] md:h-[100px] rounded-lg overflow-hidden flex-shrink-0">
                                    {podium.brand1.imageUrl ? (
                                        <Image
                                            src={podium.brand1.imageUrl}
                                            width={100}
                                            height={100}
                                            alt={podium.brand1.name}
                                            className="w-full h-full object-contain"
                                            priority={priority}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-2xl text-zinc-600">
                                            {podium.brand1.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-2xl sm:text-4xl md:text-5xl font-black font-display mt-auto bg-gradient-to-b from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                                    1
                                </span>
                                <span className="text-[10px] md:text-xs text-zinc-300 font-medium text-center truncate w-full px-1">
                                    {podium.brand1.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {podium.brand3 && (
                    <div className="flex flex-col items-center">
                        <div
                            className="w-[70px] sm:w-[90px] md:w-[110px] h-[120px] sm:h-[150px] md:h-[180px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-2">
                                <div className="w-[60px] sm:w-[80px] md:w-[100px] h-[60px] sm:h-[80px] md:h-[100px] rounded-lg overflow-hidden flex-shrink-0">
                                    {podium.brand3.imageUrl ? (
                                        <Image
                                            src={podium.brand3.imageUrl}
                                            width={100}
                                            height={100}
                                            alt={podium.brand3.name}
                                            className="w-full h-full object-contain"
                                            priority={priority}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-2xl text-zinc-600">
                                            {podium.brand3.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-2xl sm:text-4xl md:text-5xl font-black font-display mt-auto bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">
                                    3
                                </span>
                                <span className="text-[10px] md:text-xs text-zinc-400 font-medium text-center truncate w-full px-1">
                                    {podium.brand3.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
