"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import { copyToClipboard } from "@/lib/intelligence/export"

interface TickerCopyButtonProps {
    contractAddress: string
}

export function TickerCopyButton({ contractAddress }: TickerCopyButtonProps) {
    const handleCopy = async () => {
        const copied = await copyToClipboard(contractAddress)
        if (copied) {
            toast.success("Contract copied")
            return
        }
        toast.error("Clipboard not available in this browser")
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy token contract"
            title="Copy token contract"
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-700/40 text-zinc-300 transition-colors hover:bg-zinc-600/60 hover:text-white"
        >
            <Copy className="h-5 w-5" />
        </button>
    )
}
