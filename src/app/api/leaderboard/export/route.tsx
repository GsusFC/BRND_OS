import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import type { CSSProperties } from 'react'

export const runtime = 'edge'

type InterWeight = 400 | 700 | 900

const INTER_URLS: Record<InterWeight, string> = {
    400: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-400-normal.woff',
    700: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-700-normal.woff',
    900: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-900-normal.woff',
}

const interFontCache: Partial<Record<InterWeight, ArrayBuffer>> = {}
const interFontPromises: Partial<Record<InterWeight, Promise<ArrayBuffer>>> = {}

const fetchArrayBufferWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Failed to fetch (HTTP ${res.status})`)
        return await res.arrayBuffer()
    } finally {
        clearTimeout(timeoutId)
    }
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(buffer).toString('base64')
    }

    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
    return btoa(binary)
}

const fetchImageAsDataUri = async (url: string, timeoutMs: number) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (!res.ok) return null

        const contentType = res.headers.get('content-type') || 'image/png'
        const buffer = await res.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        return `data:${contentType};base64,${base64}`
    } catch {
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

const getInterFontData = async (weight: InterWeight) => {
    if (interFontCache[weight]) return interFontCache[weight]!

    if (!interFontPromises[weight]) {
        interFontPromises[weight] = fetchArrayBufferWithTimeout(INTER_URLS[weight], 1500)
    }

    const data = await interFontPromises[weight]!
    interFontCache[weight] = data
    return data
}

interface ExportEntry {
    rank: number
    name: string
    imageUrl?: string
    score: number
    gold: number
    silver: number
    bronze: number
    totalPodiums: number
}

interface ExportRequest {
    entries: ExportEntry[]
    title?: string
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as ExportRequest
        const { entries } = body

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: 'Invalid entries data' }, { status: 400 })
        }

        const limitedEntries = entries.slice(0, 10)

        const preparedEntries = await Promise.all(
            limitedEntries.map(async (entry) => {
                if (!entry.imageUrl) return { ...entry, imageDataUri: null }
                const imageDataUri = await fetchImageAsDataUri(entry.imageUrl, 2500)
                return { ...entry, imageDataUri }
            }),
        )

        let font400: ArrayBuffer | null = null
        let font700: ArrayBuffer | null = null
        let font900: ArrayBuffer | null = null

        try {
            ;[font400, font700, font900] = await Promise.all([
                getInterFontData(400),
                getInterFontData(700),
                getInterFontData(900),
            ])
        } catch {
            font400 = null
            font700 = null
            font900 = null
        }

        const BASE_WIDTH = 1000
        const BASE_HEIGHT = 900
        const EXPORT_SCALE = 2
        const scale = (value: number) => value * EXPORT_SCALE
        const WIDTH = BASE_WIDTH * EXPORT_SCALE
        const HEIGHT = BASE_HEIGHT * EXPORT_SCALE
        const CARD_PADDING = scale(32)
        const HEADER_HEIGHT = scale(56)
        const CARD_HEIGHT = HEIGHT - CARD_PADDING * 2
        const ROWS_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT
        const ROW_HEIGHT = Math.floor(ROWS_HEIGHT / preparedEntries.length)
        const COL_RANK = scale(70)
        const COL_SCORE = scale(150)
        const COL_BREAKDOWN = scale(240)
        const COL_TOTAL = scale(120)

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        flexDirection: 'column',
                        backgroundColor: '#121213', // Custom dark background
                        fontFamily: 'Inter',
                        boxSizing: 'border-box',
                    }}
                >
                    <div
                        style={{
                            width: `${WIDTH}px`,
                            height: `${HEIGHT}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#121213',
                            paddingTop: CARD_PADDING,
                            paddingBottom: CARD_PADDING,
                            paddingLeft: CARD_PADDING,
                            paddingRight: CARD_PADDING,
                            boxSizing: 'border-box',
                        }}
                    >
                    {/* Main Card */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#121213',
                            borderRadius: scale(16),
                            border: '1px solid #27272a', // zinc-800
                            width: '100%',
                            height: CARD_HEIGHT,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingLeft: scale(28),
                                paddingRight: scale(28),
                                height: HEADER_HEIGHT,
                                backgroundColor: '#18181b',
                                borderBottom: '1px solid #27272a',
                                color: '#ffffff',
                                fontSize: scale(14),
                                fontWeight: 700,
                                lineHeight: 1.2,
                                width: '100%',
                                flexShrink: 0,
                            }}
                        >
                            <div style={{ width: COL_RANK, color: '#d4d4d8', letterSpacing: scale(1), textAlign: 'center' }}>RANK</div>
                            <div style={{ flex: 1, color: '#d4d4d8', letterSpacing: scale(1) }}>BRAND</div>
                            <div style={{ width: COL_SCORE, color: '#d4d4d8', textAlign: 'center', letterSpacing: scale(1) }}>SCORE</div>
                            <div style={{ width: COL_BREAKDOWN, color: '#d4d4d8', textAlign: 'center', letterSpacing: scale(1), paddingLeft: 100 }}>VOTE BREAKDOWN</div>
                            <div style={{ width: COL_TOTAL, color: '#d4d4d8', textAlign: 'center', letterSpacing: scale(1) }}>TOTAL PODIUMS</div>
                        </div>

                        {/* Rows Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: ROWS_HEIGHT }}>
                            {preparedEntries.map((entry, idx) => {
                                // Rank styles
                                let rankBackground: CSSProperties = { backgroundColor: '#27272a' }
                                let rankColor = '#a1a1aa'
                                let rankBorder = '1px solid #3f3f46' // zinc-700

                                if (entry.rank === 1) {
                                    rankBackground = { backgroundImage: 'linear-gradient(to bottom right, #facc15, #ca8a04)' } // yellow-400 to yellow-600
                                    rankColor = 'black'
                                    rankBorder = 'none'
                                } else if (entry.rank === 2) {
                                    rankBackground = { backgroundImage: 'linear-gradient(to bottom right, #d4d4d8, #71717a)' } // zinc-300 to zinc-500
                                    rankColor = 'black'
                                    rankBorder = 'none'
                                } else if (entry.rank === 3) {
                                    rankBackground = { backgroundImage: 'linear-gradient(to bottom right, #d97706, #92400e)' } // amber-600 to amber-800
                                    rankColor = 'white'
                                    rankBorder = 'none'
                                }

                                // Score color
                                let scoreColor = '#ffffff'
                                if (entry.rank === 1) scoreColor = '#facc15'
                                else if (entry.rank === 2) scoreColor = '#d4d4d8'
                                else if (entry.rank === 3) scoreColor = '#fbbf24'

                                return (
                                    <div
                                        key={entry.rank}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingLeft: scale(28),
                                            paddingRight: scale(28),
                                            height: ROW_HEIGHT,
                                            borderBottom: idx < preparedEntries.length - 1 ? '1px solid rgba(39, 39, 42, 0.5)' : 'none',
                                            backgroundColor: entry.rank <= 3 ? 'rgba(24, 24, 27, 0.3)' : 'transparent',
                                            width: '100%',
                                        }}
                                    >
                                        {/* Rank Badge */}
                                        <div style={{ width: COL_RANK, display: 'flex', alignItems: 'center', justifyContent: 'center', height: scale(36) }}>
                                            <div style={{
                                                width: scale(36), height: scale(36), borderRadius: scale(18),
                                                ...rankBackground,
                                                border: rankBorder,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: scale(16), color: rankColor,
                                                boxShadow: entry.rank <= 3 ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none'
                                            }}>
                                                {entry.rank}
                                            </div>
                                        </div>

                                        {/* Brand */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: scale(12), height: scale(36) }}>
                                            {/* Logo */}
                                            {entry.imageDataUri ? (
                                                <div style={{
                                                    width: scale(36), height: scale(36), borderRadius: scale(8),
                                                    border: '1px solid #27272a',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={entry.imageDataUri}
                                                        width={scale(72)}
                                                        height={scale(72)}
                                                        style={{ width: scale(36), height: scale(36), objectFit: 'cover', display: 'block' }}
                                                        alt=""
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{
                                                    width: scale(36), height: scale(36), borderRadius: scale(8),
                                                    border: '1px solid #27272a', backgroundColor: '#27272a',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a',
                                                    fontWeight: 700, fontSize: scale(16),
                                                    lineHeight: `${scale(36)}px`,
                                                    flexShrink: 0,
                                                }}>
                                                    {entry.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            {/* Name */}
                                            <div style={{ height: scale(36), display: 'flex', alignItems: 'center' }}>
                                                <div style={{
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: scale(16),
                                                    height: scale(36),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    marginTop: scale(-2),
                                                }}>{entry.name}</div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{ width: COL_SCORE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: scoreColor, fontWeight: 700, fontSize: scale(18), height: scale(36) }}>
                                            <div style={{ width: '100%', textAlign: 'center' }}>{entry.score.toLocaleString()}</div>
                                        </div>

                                        {/* Breakdown */}
                                        <div style={{ width: COL_BREAKDOWN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: scale(14), height: scale(36), paddingLeft: scale(24) }}>
                                            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: scale(14), marginRight: scale(12) }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: scale(6) }}>
                                                    <div style={{ width: scale(10), height: scale(10), borderRadius: 999, backgroundColor: '#facc15' }} />
                                                    <span style={{ color: '#d4d4d8' }}>{entry.gold}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: scale(6) }}>
                                                    <div style={{ width: scale(10), height: scale(10), borderRadius: 999, backgroundColor: '#d4d4d8' }} />
                                                    <span style={{ color: '#a1a1aa' }}>{entry.silver}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: scale(6) }}>
                                                    <div style={{ width: scale(10), height: scale(10), borderRadius: 999, backgroundColor: '#d97706' }} />
                                                    <span style={{ color: '#71717a' }}>{entry.bronze}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div style={{ width: COL_TOTAL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontWeight: 700, fontSize: scale(16), height: scale(36) }}>
                                            {entry.totalPodiums}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    </div>
                </div>
            ),
            {
                width: WIDTH,
                height: HEIGHT,
                ...(font400 && font700 && font900
                    ? {
                          fonts: [
                              {
                                  name: 'Inter',
                                  data: font400,
                                  style: 'normal',
                                  weight: 400,
                              },
                              {
                                  name: 'Inter',
                                  data: font700,
                                  style: 'normal',
                                  weight: 700,
                              },
                              {
                                  name: 'Inter',
                                  data: font900,
                                  style: 'normal',
                                  weight: 900,
                              },
                          ],
                      }
                    : {}),
            },
        )
    } catch (e: unknown) {
        console.error("Error generating image:", e)
        const details = e instanceof Error ? e.message : 'Unknown error'
        return NextResponse.json({
            error: "Error generating image",
            details,
        }, { status: 500 })
    }
}
