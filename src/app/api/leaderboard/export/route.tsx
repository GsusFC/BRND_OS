import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'

// export const runtime = 'edge'

type InterWeight = 400 | 700 | 900

const INTER_URLS: Record<InterWeight, string> = {
    400: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-400-normal.woff',
    700: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-700-normal.woff',
    900: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.15/files/inter-latin-900-normal.woff',
}

const interFontCache: Partial<Record<InterWeight, ArrayBuffer>> = {}
const interFontPromises: Partial<Record<InterWeight, Promise<ArrayBuffer>>> = {}

const getInterFontData = async (weight: InterWeight) => {
    if (interFontCache[weight]) return interFontCache[weight]!

    if (!interFontPromises[weight]) {
        interFontPromises[weight] = fetch(INTER_URLS[weight], {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        }).then(async (res) => {
            if (!res.ok) throw new Error(`Failed to fetch Inter font ${weight} (HTTP ${res.status})`)
            return res.arrayBuffer()
        })
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

        const [font400, font700, font900] = await Promise.all([
            getInterFontData(400),
            getInterFontData(700),
            getInterFontData(900),
        ])

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#09090b', // zinc-950
                        padding: '32px',
                        fontFamily: 'Inter',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Main Card */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            backgroundColor: '#09090b',
                            borderRadius: '16px',
                            border: '1px solid #27272a', // zinc-800
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                padding: '18px 28px',
                                backgroundColor: 'rgba(24, 24, 27, 0.5)', // zinc-900/50
                                borderBottom: '1px solid #27272a',
                                color: '#71717a', // zinc-500
                                fontSize: '12px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <div style={{ width: '70px', display: 'flex', alignItems: 'center' }}>Rank</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>Brand</div>
                            <div style={{ width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Score</div>
                            <div style={{ width: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Podium Breakdown</div>
                            <div style={{ width: '110px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Podiums</div>
                        </div>

                        {/* Rows Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            {entries.map((entry, idx) => {
                                // Rank styles
                                let rankBackground: React.CSSProperties = { backgroundColor: '#27272a' }
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
                                            padding: '0 28px',
                                            flex: 1, // Distribute height evenly
                                            borderBottom: idx < entries.length - 1 ? '1px solid rgba(39, 39, 42, 0.5)' : 'none',
                                            backgroundColor: entry.rank <= 3 ? 'rgba(24, 24, 27, 0.3)' : 'transparent',
                                        }}
                                    >
                                        {/* Rank Badge */}
                                        <div style={{ width: '70px', display: 'flex', alignItems: 'center', height: '36px' }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                ...rankBackground,
                                                border: rankBorder,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: '16px', color: rankColor,
                                                boxShadow: entry.rank <= 3 ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none'
                                            }}>
                                                {entry.rank}
                                            </div>
                                        </div>

                                        {/* Brand */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', height: '36px' }}>
                                            {/* Logo */}
                                            {entry.imageUrl ? (
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '8px',
                                                    border: '1px solid #27272a',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={entry.imageUrl}
                                                        width="36"
                                                        height="36"
                                                        style={{ objectFit: 'cover', display: 'block' }}
                                                        alt=""
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '8px',
                                                    border: '1px solid #27272a', backgroundColor: '#27272a',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a',
                                                    fontWeight: 700, fontSize: '16px',
                                                    lineHeight: '36px',
                                                    flexShrink: 0,
                                                }}>
                                                    {entry.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            {/* Name */}
                                            <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                                                <div style={{
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '16px',
                                                    height: '36px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    marginTop: '-2px',
                                                }}>{entry.name}</div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{ width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: scoreColor, fontWeight: 700, fontSize: '18px', height: '36px' }}>{entry.score.toLocaleString()}</div>

                                        {/* Breakdown */}
                                        <div style={{ width: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', fontSize: '14px', height: '36px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>🥇</span><span style={{ color: '#d4d4d8' }}>{entry.gold}</span></div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>🥈</span><span style={{ color: '#a1a1aa' }}>{entry.silver}</span></div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>🥉</span><span style={{ color: '#71717a' }}>{entry.bronze}</span></div>
                                        </div>

                                        {/* Total */}
                                        <div style={{ width: '110px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#a1a1aa', fontWeight: 700, fontSize: '16px', height: '36px' }}>{entry.totalPodiums}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1000,
                height: 900,
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
