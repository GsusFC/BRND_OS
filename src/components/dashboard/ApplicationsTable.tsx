import { ExternalLink, Globe, MessageCircle, Wallet } from 'lucide-react'
import Image from 'next/image'

interface Application {
    id: number
    name: string
    description: string | null
    url: string | null
    warpcastUrl: string | null
    imageUrl: string | null
    walletAddress?: string | null
    createdAt: Date
    category: { id: number; name: string } | null
}

interface ApplicationsTableProps {
    applications: Application[]
}

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
    if (applications.length === 0) {
        return (
            <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-zinc-400 font-mono text-sm">
                    No new applications
                </p>
                <p className="text-zinc-600 font-mono text-xs mt-2">
                    Applications from /apply will appear here
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {applications.map((app) => (
                <div
                    key={app.id}
                    className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
                >
                    <div className="flex items-start gap-4">
                        {/* Logo */}
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                            {app.imageUrl ? (
                                <Image
                                    src={app.imageUrl}
                                    alt={app.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-600">
                                    {app.name.charAt(0)}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white truncate">
                                    {app.name}
                                </h3>
                                {app.category && (
                                    <span className="px-2 py-0.5 text-xs font-mono bg-zinc-800 text-zinc-400 rounded">
                                        {app.category.name}
                                    </span>
                                )}
                            </div>

                            {app.description && (
                                <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                                    {app.description}
                                </p>
                            )}

                            {/* Links */}
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {app.url && (
                                    <a
                                        href={app.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        Website
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                                {app.warpcastUrl && (
                                    <a
                                        href={app.warpcastUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-purple-400 transition-colors"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Warpcast
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                                {app.walletAddress && (
                                    <a
                                        href={`https://basescan.org/address/${app.walletAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-blue-400 transition-colors"
                                    >
                                        <Wallet className="w-3.5 h-3.5" />
                                        {app.walletAddress.slice(0, 6)}...{app.walletAddress.slice(-4)}
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>

                            {/* Timestamp */}
                            <p className="mt-2 text-xs text-zinc-600 font-mono">
                                Submitted {new Date(app.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>

                        {/* ID badge */}
                        <div className="flex-shrink-0">
                            <span className="px-3 py-1.5 text-xs font-mono bg-zinc-800 text-zinc-500 rounded-lg">
                                ID: {app.id}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
