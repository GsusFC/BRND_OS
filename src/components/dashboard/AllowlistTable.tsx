'use client'

import { removeAllowedWallet } from '@/lib/actions/wallet-actions'
import { Trash2, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table'

interface Wallet {
    id: number
    address: string
    label: string | null
    createdAt: string | Date
}

interface AllowlistTableProps {
    wallets: Wallet[]
    canEdit: boolean
}

export function AllowlistTable({ wallets, canEdit }: AllowlistTableProps) {
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
            <Card className="p-12 text-center">
                <p className="text-zinc-500 font-mono text-sm">
                    No wallets in allowlist yet
                </p>
                <p className="text-zinc-600 font-mono text-xs mt-2">
                    Add a wallet above to get started
                </p>
            </Card>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {wallets.map((wallet) => (
                    <TableRow key={wallet.id}>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <code className="font-mono text-white">
                                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                                </code>
                                <Button
                                    onClick={() => copyAddress(wallet.address)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-500 hover:text-white"
                                    title="Copy full address"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-500 hover:text-white"
                                >
                                    <a
                                        href={`https://basescan.org/address/${wallet.address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="View on Basescan"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </Button>
                            </div>
                        </TableCell>
                        <TableCell className="font-mono text-zinc-400">
                            {wallet.label || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-zinc-500">
                            {new Date(wallet.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </TableCell>
                        <TableCell className="text-right">
                            {canEdit ? (
                                <Button
                                    onClick={() => handleRemove(wallet.id, wallet.address)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-950/50"
                                    title="Remove from allowlist"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            ) : (
                                <span className="text-xs font-mono text-zinc-600">—</span>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={4}>
                        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} in allowlist
                    </TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    )
}
