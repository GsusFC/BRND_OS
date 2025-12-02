'use client'

import Image from "next/image"
import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"

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
const CAROUSEL_INTERVAL = 8000 // 8 segundos entre rotaciones

export function PodiumStack() {
    const [podiums, setPodiums] = useState<Podium[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeIndex, setActiveIndex] = useState(0)

    const fetchPodiums = useCallback(async () => {
        try {
            const res = await fetch('/api/landing/podiums')
            if (res.ok) {
                const data = await res.json()
                const newPodiums = data.podiums as Podium[]
                setPodiums(newPodiums)
            }
        } catch (error) {
            console.error('Error fetching podiums:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPodiums()
        const interval = setInterval(fetchPodiums, POLLING_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchPodiums])

    // Carrusel automático - rota hacia atrás
    useEffect(() => {
        if (podiums.length <= 1) return

        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % podiums.length)
        }, CAROUSEL_INTERVAL)

        return () => clearInterval(interval)
    }, [podiums.length])

    if (isLoading) {
        return (
            <div className="relative z-20 -mt-[270px] md:-mt-[320px] lg:-mt-[350px] px-6 pb-32">
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
            </div>
        )
    }

    if (podiums.length === 0) {
        return null
    }

    // Reordenar podiums para que el activo esté al frente
    const getVisiblePodiums = () => {
        const visible: { podium: Podium; position: number }[] = []
        for (let i = 0; i < Math.min(4, podiums.length); i++) {
            const idx = (activeIndex + i) % podiums.length
            visible.push({ podium: podiums[idx], position: i })
        }
        return visible
    }

    const visiblePodiums = getVisiblePodiums()

    return (
        <section className="relative z-20 -mt-[270px] md:-mt-[320px] lg:-mt-[350px] px-6 pb-32">
            <div className="mx-auto max-w-7xl">
                {/* Stack de cards */}
                <div className="relative flex justify-center items-center" style={{ perspective: '1500px' }}>
                    {/* 16:9 aspect ratio container */}
                    <div className="relative w-[640px] h-[360px] md:w-[800px] md:h-[450px] lg:w-[960px] lg:h-[540px]">
                        <AnimatePresence mode="popLayout">
                            {visiblePodiums.map(({ podium, position }) => (
                                <PodiumCard
                                    key={podium.id}
                                    podium={podium}
                                    position={position}
                                    total={visiblePodiums.length}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    )
}

function PodiumCard({ 
    podium, 
    position, 
    total 
}: { 
    podium: Podium
    position: number
    total: number
}) {
    // La card en position 0 está al frente, las demás detrás con offset
    const zIndex = total - position
    const translateY = position * 20
    const translateZ = position * -50
    const scale = 1 - (position * 0.04)
    const cardOpacity = 1 - (position * 0.2)

    return (
        <motion.div
            layout
            initial={{ 
                y: translateY,
                scale,
                opacity: cardOpacity,
                zIndex
            }}
            animate={{ 
                y: translateY,
                scale,
                opacity: cardOpacity,
                zIndex
            }}
            exit={{ 
                y: 80, 
                scale: 0.85, 
                opacity: 0,
                zIndex: total + 1
            }}
            transition={{ 
                type: "spring",
                stiffness: 80,
                damping: 18,
                duration: 1.5
            }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl"
            style={{
                transformStyle: 'preserve-3d',
                transform: `translateZ(${translateZ}px)`,
            }}
        >
            {/* Header con usuario y fecha */}
            <div className="flex items-center justify-between px-8 pt-6 pb-4">
                <div className="flex items-center gap-4">
                    {podium.userPhoto ? (
                        <Image
                            src={podium.userPhoto}
                            width={48}
                            height={48}
                            alt={podium.username}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20"
                        />
                    ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">
                            {podium.username.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="text-lg font-semibold text-white">
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

            {/* Podium Visual - Olympic Style - Centered */}
            <div className="flex items-end justify-center gap-4 flex-1 px-8 pb-8">
                {/* 2nd Place - Silver (Left) */}
                {podium.brand2 && (
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-[110px] md:w-[140px] h-[240px] md:h-[300px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-3">
                                <div className="w-[100px] md:w-[130px] h-[100px] md:h-[130px] rounded-lg overflow-hidden flex-shrink-0 -mt-[2px]">
                                    {podium.brand2.imageUrl ? (
                                        <Image
                                            src={podium.brand2.imageUrl}
                                            width={130}
                                            height={130}
                                            alt={podium.brand2.name}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-3xl text-zinc-600">
                                            {podium.brand2.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-5xl md:text-6xl font-black font-display mt-auto bg-gradient-to-b from-gray-200 to-gray-400 bg-clip-text text-transparent">
                                    2
                                </span>
                                <span className="text-xs md:text-sm text-zinc-400 font-medium text-center truncate w-full px-2">
                                    {podium.brand2.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1st Place - Gold (Center) - Tallest */}
                {podium.brand1 && (
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-[110px] md:w-[140px] h-[290px] md:h-[380px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-3">
                                <div className="w-[100px] md:w-[130px] h-[100px] md:h-[130px] rounded-lg overflow-hidden flex-shrink-0 -mt-[2px]">
                                    {podium.brand1.imageUrl ? (
                                        <Image
                                            src={podium.brand1.imageUrl}
                                            width={130}
                                            height={130}
                                            alt={podium.brand1.name}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-3xl text-zinc-600">
                                            {podium.brand1.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-5xl md:text-6xl font-black font-display mt-auto bg-gradient-to-b from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                                    1
                                </span>
                                <span className="text-xs md:text-sm text-zinc-300 font-medium text-center truncate w-full px-2">
                                    {podium.brand1.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3rd Place - Bronze (Right) - Shortest */}
                {podium.brand3 && (
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-[110px] md:w-[140px] h-[200px] md:h-[250px] rounded-t-xl flex flex-col items-center p-[1px]"
                            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.8))' }}
                        >
                            <div className="w-full h-full rounded-t-[10px] bg-zinc-950 flex flex-col items-center pt-1 pb-3">
                                <div className="w-[100px] md:w-[130px] h-[100px] md:h-[130px] rounded-lg overflow-hidden flex-shrink-0 -mt-[2px]">
                                    {podium.brand3.imageUrl ? (
                                        <Image
                                            src={podium.brand3.imageUrl}
                                            width={130}
                                            height={130}
                                            alt={podium.brand3.name}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-3xl text-zinc-600">
                                            {podium.brand3.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-5xl md:text-6xl font-black font-display mt-auto bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">
                                    3
                                </span>
                                <span className="text-xs md:text-sm text-zinc-400 font-medium text-center truncate w-full px-2">
                                    {podium.brand3.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
