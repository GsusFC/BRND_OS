import Link from "next/link"
import { getTokenGateSettings } from "@/lib/actions/wallet-actions"
import { TokenSettingsForm } from "@/components/dashboard/TokenSettingsForm"
import { auth } from "@/auth"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AllowlistPage() {
    const session = await auth()
    const isAuthenticated = Boolean(session?.user)

    let settings = { minTokenBalance: '5000000' }
    let error: string | null = null

    try {
        settings = await getTokenGateSettings()
    } catch (e) {
        console.error('Failed to fetch data:', e)
        error = e instanceof Error ? e.message : 'Failed to load data'
    }

    if (error) {
        return (
            <div className="w-full">
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Token Gate
                </h1>
                <div className="mt-8 p-6 bg-red-950/30 border border-red-900/50 rounded-xl">
                    <p className="text-red-400 font-mono text-sm">Error: {error}</p>
                    <p className="text-zinc-500 font-mono text-xs mt-2">
                        Check TURSO_ALLOWLIST_DATABASE_URL and TURSO_ALLOWLIST_AUTH_TOKEN environment variables.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Token Gate
                </h1>
            </div>

            <p className="mt-2 text-zinc-500 font-mono text-sm">
                Manage token requirements for the brand application form
            </p>

            {!isAuthenticated ? (
                <div className="mt-6 rounded-xl border border-yellow-900/40 bg-yellow-950/20 p-4">
                    <p className="text-sm font-mono text-yellow-300">
                        Sign in required to edit token gate settings.
                    </p>
                    <p className="mt-1 text-xs font-mono text-zinc-500">
                        Token Gate Settings can be updated by any authenticated user.
                    </p>
                    <div className="mt-3">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-mono font-semibold text-black hover:bg-white/90"
                        >
                            Go to Login
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="mt-8 max-w-xl">
                <TokenSettingsForm currentMinBalance={settings.minTokenBalance} canEdit={isAuthenticated} />
            </div>
        </div>
    )
}
