'use client'

import { ReactNode } from 'react'
import { useTokenGate } from '@/hooks/useTokenGate'
import { useAppKit } from '@reown/appkit/react'
import { TOKEN_GATE_CONFIG } from '@/config/tokengate'
import { Wallet, Lock, RefreshCw, ExternalLink } from 'lucide-react'

interface TokenGateProps {
    children: ReactNode
}

export function TokenGate({ children }: TokenGateProps) {
    const {
        isConnected,
        address,
        formattedBalance,
        isLoading,
        isError,
        hasAccess,
        requiredBalance,
        refetch,
    } = useTokenGate()

    const { open } = useAppKit()

    // State 1: Not connected - Show connect wallet prompt
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6">
                    <Wallet className="w-10 h-10 text-zinc-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display uppercase">
                    Connect Your Wallet
                </h3>
                <p className="text-zinc-400 font-mono text-sm max-w-md mb-8">
                    To apply for a brand listing, you need to connect your wallet and hold at least{' '}
                    <span className="text-white font-bold">{requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span> tokens.
                </p>
                <button
                    onClick={() => open()}
                    className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-xl font-bold font-mono uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                </button>
            </div>
        )
    }

    // State 2: Loading balance
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 animate-pulse">
                    <RefreshCw className="w-10 h-10 text-zinc-500 animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-display uppercase">
                    Verifying Token Balance
                </h3>
                <p className="text-zinc-500 font-mono text-sm">
                    Checking your {TOKEN_GATE_CONFIG.tokenSymbol} balance on Base...
                </p>
            </div>
        )
    }

    // State 3: Error fetching balance
    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-display uppercase">
                    Error Verifying Balance
                </h3>
                <p className="text-zinc-400 font-mono text-sm mb-6">
                    There was an error checking your token balance. Please try again.
                </p>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-mono text-sm transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </div>
        )
    }

    // State 4: No access - Insufficient balance
    if (!hasAccess) {
        const currentBalance = parseFloat(formattedBalance).toLocaleString(undefined, {
            maximumFractionDigits: 0,
        })

        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-amber-950 border border-amber-700 flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display uppercase">
                    Insufficient Token Balance
                </h3>
                <p className="text-zinc-400 font-mono text-sm max-w-md mb-6">
                    You need at least{' '}
                    <span className="text-white font-bold">{requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span>{' '}
                    to apply for a brand listing.
                </p>

                {/* Balance display */}
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8 w-full max-w-sm">
                    <div className="text-xs font-mono text-zinc-500 uppercase mb-2">Your Balance</div>
                    <div className="text-3xl font-bold text-white font-mono">
                        {currentBalance}
                        <span className="text-lg text-zinc-500 ml-2">{TOKEN_GATE_CONFIG.tokenSymbol}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="text-xs font-mono text-zinc-500 uppercase mb-1">Required</div>
                        <div className="text-lg font-bold text-amber-500 font-mono">
                            {requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <a
                        href={`https://app.uniswap.org/swap?outputCurrency=${TOKEN_GATE_CONFIG.tokenAddress}&chain=base`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold font-mono text-sm uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Get {TOKEN_GATE_CONFIG.tokenSymbol}
                        <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-mono text-sm transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Check Again
                    </button>
                </div>

                {/* Connected address */}
                <p className="mt-8 text-xs font-mono text-zinc-600">
                    Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
            </div>
        )
    }

    // State 5: Has access - Show children (the form)
    return <>{children}</>
}
