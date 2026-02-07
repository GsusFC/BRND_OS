'use client'

import { ExternalLink, QrCode } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface WalletConnectQrPopoverProps {
    uri: string | null
    className?: string
}

export function WalletConnectQrPopover({ uri, className }: WalletConnectQrPopoverProps) {
    if (!uri) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-mono text-zinc-200 transition-colors hover:bg-zinc-800',
                        className,
                    )}
                >
                    <QrCode className="size-3.5" />
                    <span>Show QR</span>
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Connect Wallet</DialogTitle>
                    <DialogDescription>
                        Scan this QR with your wallet app or open the deep link.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 flex flex-col items-center gap-3">
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`}
                        alt="WalletConnect QR"
                        className="size-48 rounded-lg border border-zinc-700 bg-white p-2"
                    />

                    <a
                        href={uri}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 underline"
                    >
                        <span>Open WalletConnect link</span>
                        <ExternalLink className="size-3.5" />
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    )
}
