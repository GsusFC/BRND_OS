"use client"

import { useState, useTransition, useOptimistic } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { toggleBrandStatus } from "@/lib/actions/brand-actions"

interface ToggleStatusButtonProps {
    brandId: number
    brandName: string
    currentStatus: number
}

export function ToggleStatusButton({ brandId, brandName, currentStatus }: ToggleStatusButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()
    
    // Optimistic update: muestra el nuevo estado inmediatamente
    const [optimisticStatus, setOptimisticStatus] = useOptimistic(
        currentStatus,
        (_, newStatus: number) => newStatus
    )

    const isApproving = optimisticStatus === 1
    const actionText = isApproving ? "approve" : "ban"

    const handleToggle = () => {
        const newStatus = optimisticStatus === 1 ? 0 : 1
        startTransition(async () => {
            setOptimisticStatus(newStatus)
            await toggleBrandStatus(brandId, currentStatus)
            setShowConfirm(false)
        })
    }

    if (showConfirm) {
        return (
            <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400 font-mono mr-1">
                    {isApproving ? "Approve?" : "Ban?"}
                </span>
                <button
                    onClick={handleToggle}
                    disabled={isPending}
                    className={`rounded-lg p-1.5 transition-all ${
                        isApproving
                            ? "bg-green-600 hover:bg-green-500 text-white"
                            : "bg-red-600 hover:bg-red-500 text-white"
                    } disabled:opacity-50`}
                    aria-label={`Confirm ${actionText}`}
                >
                    {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                    )}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-all disabled:opacity-50"
                    aria-label="Cancel"
                >
                    <XCircle className="w-3.5 h-3.5" />
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className={`rounded-lg border border-transparent p-2 transition-all ${
                isApproving
                    ? "text-green-500 hover:bg-green-950/30 hover:text-green-400"
                    : "text-red-500 hover:bg-red-950/30 hover:text-red-400"
            }`}
            title={isApproving ? `Approve ${brandName}` : `Ban ${brandName}`}
            aria-label={isApproving ? `Approve ${brandName}` : `Ban ${brandName}`}
        >
            {isApproving ? (
                <CheckCircle className="w-4 h-4" />
            ) : (
                <XCircle className="w-4 h-4" />
            )}
        </button>
    )
}
