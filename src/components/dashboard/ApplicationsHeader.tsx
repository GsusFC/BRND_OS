"use client"

import ConnectButton from "@/components/web3/ConnectButton"

export function ApplicationsHeader({ totalCount }: { totalCount: number }) {
    return (
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-4xl font-black text-white font-display uppercase">
                Applications
            </h1>
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-400 font-mono text-sm">
                        {totalCount} pending
                    </span>
                </div>
                <ConnectButton />
            </div>
        </div>
    )
}
