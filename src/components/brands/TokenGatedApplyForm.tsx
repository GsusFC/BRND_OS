'use client'

import { ApplyForm } from "./ApplyForm"
import { TokenGate } from "@/components/web3/TokenGate"
import { useTokenGate } from "@/hooks/useTokenGate"
import { TOKEN_GATE_CONFIG } from "@/config/tokengate"

type Category = {
    id: number
    name: string
}

interface TokenGatedApplyFormProps {
    categories: Category[]
}

export function TokenGatedApplyForm({ categories }: TokenGatedApplyFormProps) {
    const { formattedBalance, isConnected, hasFullAccess } = useTokenGate()
    const disableOnchain = process.env.NEXT_PUBLIC_DISABLE_ONCHAIN_GATING === 'true'

    return (
        <TokenGate showConnectButton={false}>
            {/* Show verified badge when user has full access */}
            {isConnected && hasFullAccess && (
                <div className="mb-6 flex items-center justify-between p-4 bg-green-950/50 border border-green-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-mono text-green-400">
                            Access Verified
                        </span>
                    </div>
                    {!disableOnchain ? (
                        <span className="text-sm font-mono text-zinc-400">
                            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number.parseFloat(formattedBalance))} {TOKEN_GATE_CONFIG.tokenSymbol}
                        </span>
                    ) : (
                        <span className="text-sm font-mono text-zinc-400">
                            Allowlist: OK
                        </span>
                    )}
                </div>
            )}
            <ApplyForm categories={categories} />
        </TokenGate>
    )
}
