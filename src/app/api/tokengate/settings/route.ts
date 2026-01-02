import { NextResponse } from 'next/server'
import turso from '@/lib/turso'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const result = await turso.execute(
            "SELECT value FROM settings WHERE key = 'minTokenBalance' ORDER BY rowid DESC LIMIT 1"
        )

        const minTokenBalance = result.rows.length > 0 
            ? (result.rows[0].value as string)
            : '10000000'

        return NextResponse.json({ minTokenBalance })
    } catch (error) {
        console.error('Error fetching tokengate settings:', error)
        // Return default on error
        return NextResponse.json({ minTokenBalance: '10000000' })
    }
}
