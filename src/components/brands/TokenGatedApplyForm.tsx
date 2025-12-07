'use client'

import { Category } from "@prisma/client"
import { ApplyForm } from "./ApplyForm"
import { TokenGate } from "@/components/web3/TokenGate"
import { useTokenGate } from "@/hooks/useTokenGate"
import { TOKEN_GATE_CONFIG } from "@/config/tokengate"

interface TokenGatedApplyFormProps {
    categories: Category[]
}

export function TokenGatedApplyForm({ categories }: TokenGatedApplyFormProps) {
    const { formattedBalance, isConnected, hasFullAccess } = useTokenGate()

    return (
        <TokenGate>
            {/* Show verified badge when user has full access */}
            {isConnected && hasFullAccess && (
                <div className="mb-6 flex items-center justify-between p-4 bg-green-950/50 border border-green-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-mono text-green-400">
                            Access Verified
                        </span>
                    </div>
                    <span className="text-sm font-mono text-zinc-400">
                        {parseFloat(formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} {TOKEN_GATE_CONFIG.tokenSymbol}
                    </span>
                </div>
            )}
            <ApplyForm categories={categories} />
        </TokenGate>
    )
}
