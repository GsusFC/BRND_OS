'use client'

import { removeAllowedWallet } from '@/lib/actions/wallet-actions'
import { Trash2, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface Wallet {
    id: number
    address: string
    label: string | null
    createdAt: string | Date
}

interface AllowlistTableProps {
    wallets: Wallet[]
}

export function AllowlistTable({ wallets }: AllowlistTableProps) {
    const copyAddress = (address: string) => {
        navigator.clipboard.writeText(address)
        toast.success('Address copied to clipboard')
    }

    const handleRemove = async (id: number, address: string) => {
        if (!confirm(`Remove ${address.slice(0, 6)}...${address.slice(-4)} from allowlist?`)) {
            return
        }

        const result = await removeAllowedWallet(id)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Wallet removed from allowlist')
        }
    }

    if (wallets.length === 0) {
        return (
            <div className="text-center py-12 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                <p className="text-zinc-500 font-mono text-sm">
                    No wallets in allowlist yet
                </p>
                <p className="text-zinc-600 font-mono text-xs mt-2">
                    Add a wallet above to get started
                </p>
            </div>
        )
    }

    return (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800">
                <thead className="bg-zinc-900/50">
                    <tr>
                        <th className="py-4 px-6 text-left text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
                            Address
                        </th>
                        <th className="py-4 px-6 text-left text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
                            Label
                        </th>
                        <th className="py-4 px-6 text-left text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
                            Added
                        </th>
                        <th className="py-4 px-6 text-right text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {wallets.map((wallet) => (
                        <tr key={wallet.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono text-white">
                                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                                    </code>
                                    <button
                                        onClick={() => copyAddress(wallet.address)}
                                        className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
                                        title="Copy full address"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <a
                                        href={`https://basescan.org/address/${wallet.address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
                                        title="View on Basescan"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </td>
                            <td className="py-4 px-6">
                                <span className="text-sm font-mono text-zinc-400">
                                    {wallet.label || '-'}
                                </span>
                            </td>
                            <td className="py-4 px-6">
                                <span className="text-sm font-mono text-zinc-500">
                                    {new Date(wallet.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                                <button
                                    onClick={() => handleRemove(wallet.id, wallet.address)}
                                    className="p-2 text-zinc-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-950/50"
                                    title="Remove from allowlist"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Count */}
            <div className="px-6 py-3 bg-zinc-900/30 border-t border-zinc-800">
                <p className="text-xs font-mono text-zinc-500">
                    {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} in allowlist
                </p>
            </div>
        </div>
    )
}
