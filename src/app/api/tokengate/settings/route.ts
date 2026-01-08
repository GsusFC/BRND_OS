import { NextResponse } from 'next/server'
import tursoAllowlist from '@/lib/turso-allowlist'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const result = await tursoAllowlist.execute(
            "SELECT value FROM settings WHERE key = 'minTokenBalance' ORDER BY rowid DESC LIMIT 1"
        )

        const minTokenBalance = result.rows.length > 0 
            ? String(result.rows[0].value)
            : '10000000'

        return NextResponse.json(
            { minTokenBalance },
            {
                headers: {
                    'Cache-Control': 'no-store, max-age=0',
                },
            }
        )
    } catch (error) {
        console.error('Error fetching tokengate settings:', error)
        // Return default on error
        return NextResponse.json(
            { minTokenBalance: '10000000' },
            {
                headers: {
                    'Cache-Control': 'no-store, max-age=0',
                },
            }
        )
    }
}
