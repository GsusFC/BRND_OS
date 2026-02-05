"use client"

import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"

export type OnchainStatus = "idle" | "validating" | "ipfs" | "signing" | "confirming"

interface OnchainProgressProps {
    status: OnchainStatus
    className?: string
    compact?: boolean
}

const STEPS = [
    { key: "validating", label: "Validate" },
    { key: "ipfs", label: "IPFS" },
    { key: "signing", label: "Sign" },
    { key: "confirming", label: "Confirm" },
] as const

export function OnchainProgress({ status, className, compact }: OnchainProgressProps) {
    const activeStepIndex = status === "idle"
        ? -1
        : STEPS.findIndex((step) => step.key === status)

    const progressPercent = activeStepIndex < 0
        ? 0
        : Math.round(((activeStepIndex + 1) / STEPS.length) * 100)

    if (status === "idle") {
        return null
    }

    if (compact) {
        return (
            <div className={cn("flex items-center gap-2 text-[10px] font-mono text-zinc-500", className)}>
                {STEPS.map((step, index) => {
                    const isActive = index === activeStepIndex
                    const isComplete = activeStepIndex > index
                    return (
                        <span
                            key={step.key}
                            className={cn(
                                "px-2 py-1 rounded border transition-colors",
                                isActive && "border-white/40 text-white",
                                isComplete && "border-emerald-500/30 text-emerald-300",
                                !isActive && !isComplete && "border-zinc-800"
                            )}
                        >
                            {step.label}
                        </span>
                    )
                })}
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {/* Status label */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                <span>Process</span>
                <span className="text-zinc-400">{status}</span>
            </div>

            {/* Steps */}
            <div className="flex flex-wrap items-center gap-2">
                {STEPS.map((step, index) => {
                    const isActive = index === activeStepIndex
                    const isComplete = activeStepIndex > index
                    return (
                        <div
                            key={step.key}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-all",
                                isActive && "border-white/60 bg-white/10 text-white",
                                isComplete && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                                !isActive && !isComplete && "border-zinc-800 text-zinc-600"
                            )}
                        >
                            {isComplete ? (
                                <Check className="w-3 h-3" />
                            ) : isActive ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            {step.label}
                        </div>
                    )
                })}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full border border-zinc-800 bg-black/50 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-white/60 to-white/80 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    )
}

export function useOnchainProgress() {
    const getStatusMessage = (status: OnchainStatus): string => {
        switch (status) {
            case "validating":
                return "Validating brand data..."
            case "ipfs":
                return "Uploading metadata to IPFS..."
            case "signing":
                return "Waiting for wallet signature..."
            case "confirming":
                return "Confirming transaction..."
            default:
                return "Ready"
        }
    }

    return { getStatusMessage }
}
