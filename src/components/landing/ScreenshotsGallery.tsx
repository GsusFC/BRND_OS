'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Registrar plugin
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
}

// Configuración de imágenes por capa (7 columnas)
// Capa 1: columnas externas (1 y 7)
// Capa 2: columnas (2 y 6)
// Capa 3: columnas (3 y 5)
// Capa 4: columna central superior/inferior (4)
// Scaler: imagen central que se expande

const LAYER_1_IMAGES = [
    '/app_pics/BRND no selected.png',
    '/app_pics/BRND selected.png',
    '/app_pics/Claim.png',
    '/app_pics/Claimed.png',
    '/app_pics/Share Now.png',
    '/app_pics/Section [BRND of the Week].png',
]

const LAYER_2_IMAGES = [
    '/app_pics/1st Position.png',
    '/app_pics/2nd Position.png',
    '/app_pics/BRND no selected.png',
    '/app_pics/BRND selected.png',
    '/app_pics/Claim.png',
    '/app_pics/Claimed.png',
]

const LAYER_3_IMAGES = [
    '/app_pics/Share Now.png',
    '/app_pics/Section [BRND of the Week].png',
    '/app_pics/1st Position.png',
    '/app_pics/2nd Position.png',
    '/app_pics/BRND no selected.png',
    '/app_pics/BRND selected.png',
]

const LAYER_4_IMAGES = [
    '/app_pics/Claim.png',
    '/app_pics/Claimed.png',
]

const SCALER_IMAGE = '/app_pics/1.png'

export function ScreenshotsGallery() {
    const sectionRef = useRef<HTMLElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const scalerRef = useRef<HTMLDivElement>(null)
    const layer1Ref = useRef<HTMLDivElement>(null)
    const layer2Ref = useRef<HTMLDivElement>(null)
    const layer3Ref = useRef<HTMLDivElement>(null)
    const layer4Ref = useRef<HTMLDivElement>(null)
    const backgroundRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const section = sectionRef.current
        const scaler = scalerRef.current
        const layer1 = layer1Ref.current
        const layer2 = layer2Ref.current
        const layer3 = layer3Ref.current
        const layer4 = layer4Ref.current
        const background = backgroundRef.current
        const title = titleRef.current

        if (!section || !scaler || !layer1 || !layer2 || !layer3 || !layer4 || !background || !title) return

        const ctx = gsap.context(() => {
            // Timeline para background y título
            const introTl = gsap.timeline({
                scrollTrigger: {
                    trigger: section,
                    start: 'top 80%',
                    end: 'top 40%',
                    scrub: 1,
                }
            })

            introTl.from(background, {
                opacity: 0,
                ease: 'power2.out',
            }, 0)

            introTl.from(title, {
                opacity: 0,
                y: 30,
                ease: 'power2.out',
            }, 0.2)

            // Timeline principal: Scaler grande que se reduce + capas aparecen
            const mainTl = gsap.timeline({
                scrollTrigger: {
                    trigger: section,
                    start: 'top 40%',
                    end: 'bottom 60%',
                    scrub: 1.5,
                }
            })

            // Scaler empieza grande (escala 3x) y se reduce a tamaño normal
            mainTl.from(scaler, {
                scale: 3,
                ease: 'power2.out',
            }, 0)

            // Capas aparecen desde el centro hacia afuera mientras scaler se reduce
            mainTl.from(layer4, {
                opacity: 0,
                scale: 0,
                ease: 'power2.out',
            }, 0.1)

            mainTl.from(layer3, {
                opacity: 0,
                scale: 0,
                ease: 'power2.out',
            }, 0.2)

            mainTl.from(layer2, {
                opacity: 0,
                scale: 0,
                ease: 'power2.out',
            }, 0.3)

            mainTl.from(layer1, {
                opacity: 0,
                scale: 0,
                ease: 'power2.out',
            }, 0.4)
        }, section)

        return () => ctx.revert()
    }, [])

    return (
        <section 
            ref={sectionRef}
            className="relative min-h-[200vh] border-t border-border"
        >
            {/* Background video - cubre toda la sección */}
            <div ref={backgroundRef} className="absolute inset-0 z-0 overflow-hidden">
                <video
                    src="/app_pics/TheAPP Background.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-auto w-full opacity-40"
                />
            </div>

            {/* Título */}
            <div ref={titleRef} className="relative z-10 flex items-center justify-center py-16">
                <h2 className="font-display text-5xl font-black uppercase text-white md:text-7xl lg:text-8xl">
                    THE APP
                </h2>
            </div>

            {/* Contenido sticky */}
            <div 
                ref={contentRef}
                className="sticky top-0 z-10 flex min-h-screen w-full items-center justify-center overflow-hidden"
            >
                {/* Grid container - 7 columnas */}
                <div 
                    className="relative mx-auto grid w-[1800px] max-w-[calc(100%-2rem)] place-content-center"
                    style={{ 
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gridTemplateRows: 'repeat(3, 1fr)',
                        gap: 'clamp(8px, 3vw, 40px)',
                    }}
                >
                    {/* Capa 1 - Columnas externas (1 y 7) */}
                    <div 
                        ref={layer1Ref}
                        className="pointer-events-none col-[1/-1] row-[1/-1] grid"
                        style={{ 
                            gridTemplateColumns: 'subgrid',
                            gridTemplateRows: 'subgrid',
                        }}
                    >
                        {LAYER_1_IMAGES.map((src, i) => (
                            <div 
                                key={`l1-${i}`}
                                className="overflow-hidden rounded-2xl"
                                style={{
                                    gridColumn: i % 2 === 0 ? 1 : 7,
                                }}
                            >
                                <Image
                                    src={src}
                                    alt={`App screenshot ${i + 1}`}
                                    width={390}
                                    height={844}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Capa 2 - Columnas (2 y 6) */}
                    <div 
                        ref={layer2Ref}
                        className="pointer-events-none col-[1/-1] row-[1/-1] grid"
                        style={{ 
                            gridTemplateColumns: 'subgrid',
                            gridTemplateRows: 'subgrid',
                        }}
                    >
                        {LAYER_2_IMAGES.map((src, i) => (
                            <div 
                                key={`l2-${i}`}
                                className="overflow-hidden rounded-2xl"
                                style={{
                                    gridColumn: i % 2 === 0 ? 2 : 6,
                                }}
                            >
                                <Image
                                    src={src}
                                    alt={`App screenshot ${i + 7}`}
                                    width={390}
                                    height={844}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Capa 3 - Columnas (3 y 5) */}
                    <div 
                        ref={layer3Ref}
                        className="pointer-events-none col-[1/-1] row-[1/-1] grid"
                        style={{ 
                            gridTemplateColumns: 'subgrid',
                            gridTemplateRows: 'subgrid',
                        }}
                    >
                        {LAYER_3_IMAGES.map((src, i) => (
                            <div 
                                key={`l3-${i}`}
                                className="overflow-hidden rounded-2xl"
                                style={{
                                    gridColumn: i % 2 === 0 ? 3 : 5,
                                }}
                            >
                                <Image
                                    src={src}
                                    alt={`App screenshot ${i + 13}`}
                                    width={390}
                                    height={844}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Capa 4 - Columna central (4) arriba y abajo */}
                    <div 
                        ref={layer4Ref}
                        className="pointer-events-none col-[1/-1] row-[1/-1] grid"
                        style={{ 
                            gridTemplateColumns: 'subgrid',
                            gridTemplateRows: 'subgrid',
                        }}
                    >
                        <div 
                            className="overflow-hidden rounded-2xl"
                            style={{ gridColumn: 4, gridRow: 1 }}
                        >
                            <Image
                                src={LAYER_4_IMAGES[0]}
                                alt="App screenshot top center"
                                width={390}
                                height={844}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div 
                            className="overflow-hidden rounded-2xl"
                            style={{ gridColumn: 4, gridRow: 3 }}
                        >
                            <Image
                                src={LAYER_4_IMAGES[1]}
                                alt="App screenshot bottom center"
                                width={390}
                                height={844}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Scaler - Imagen central (columna 4, fila 2) */}
                    <div 
                        ref={scalerRef}
                        className="relative z-10 overflow-hidden rounded-2xl shadow-2xl"
                        style={{ gridArea: '2 / 4' }}
                    >
                        <Image
                            src={SCALER_IMAGE}
                            alt="BRND App"
                            width={390}
                            height={844}
                            className="h-full w-full object-cover"
                            priority
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
