import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAdminUser } from '@/lib/auth/admin-user-server'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import tursoAllowlist from '@/lib/turso-allowlist'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await auth()
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined

        if (!sessionUser || typeof sessionUser.fid !== 'number') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let canAccess = sessionUser.role === 'admin'
        if (!canAccess) {
            const adminUser = await getAdminUser(sessionUser.fid)
            canAccess = hasPermission(adminUser, PERMISSIONS.TOKEN_GATE)
        }

        if (!canAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const result = await tursoAllowlist.execute(
            "SELECT value FROM settings WHERE key = 'minTokenBalance' ORDER BY rowid DESC LIMIT 1"
        )

        const minTokenBalance = result.rows.length > 0 
            ? String(result.rows[0].value)
            : '5000000'

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
            { minTokenBalance: '5000000' },
            {
                headers: {
                    'Cache-Control': 'no-store, max-age=0',
                },
            }
        )
    }
}
