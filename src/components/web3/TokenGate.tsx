'use client'

import { ReactNode } from 'react'
import { useTokenGate } from '@/hooks/useTokenGate'
import { useAppKit } from '@reown/appkit/react'
import { TOKEN_GATE_CONFIG } from '@/config/tokengate'
import { Wallet, Lock, RefreshCw, ExternalLink, ShieldX, ShieldCheck } from 'lucide-react'

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
        isAllowlisted,
        hasTokenAccess,
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
                    To apply for a brand listing, you need to connect your wallet, hold at least{' '}
                    <span className="text-white font-bold">{requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span> tokens,
                    and be on the allowlist.
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

    // State 2: Loading
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 animate-pulse">
                    <RefreshCw className="w-10 h-10 text-zinc-500 animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-display uppercase">
                    Verifying Access
                </h3>
                <p className="text-zinc-500 font-mono text-sm">
                    Checking token balance and allowlist status...
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
                    Error Verifying Access
                </h3>
                <p className="text-zinc-400 font-mono text-sm mb-6">
                    There was an error checking your access. Please try again.
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

    const currentBalance = parseFloat(formattedBalance).toLocaleString(undefined, {
        maximumFractionDigits: 0,
    })

    // State 4: Insufficient token balance
    if (!hasTokenAccess) {
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

    // State 5: Has tokens but NOT on allowlist
    if (!isAllowlisted) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-purple-950 border border-purple-700 flex items-center justify-center mb-6">
                    <ShieldX className="w-10 h-10 text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display uppercase">
                    Wallet Not on Allowlist
                </h3>
                <p className="text-zinc-400 font-mono text-sm max-w-md mb-6">
                    Your wallet has sufficient {TOKEN_GATE_CONFIG.tokenSymbol} tokens, but is not yet on the allowlist.
                    Contact the BRND team to request access.
                </p>

                {/* Status display */}
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8 w-full max-w-sm">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                        <span className="text-xs font-mono text-zinc-500 uppercase">Token Balance</span>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-mono text-green-400">{currentBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-500 uppercase">Allowlist Status</span>
                        <div className="flex items-center gap-2">
                            <ShieldX className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-mono text-purple-400">Not Listed</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <a
                        href="https://warpcast.com/brnd"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold font-mono text-sm uppercase tracking-wide transition-colors"
                    >
                        Contact BRND
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

    // State 6: Full access - Show children (the form)
    return <>{children}</>
}
