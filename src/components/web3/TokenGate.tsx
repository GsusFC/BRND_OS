'use client'

import { ReactNode } from 'react'
import { useTokenGate } from '@/hooks/useTokenGate'
import { TOKEN_GATE_CONFIG } from '@/config/tokengate'
import { Wallet, Lock, RefreshCw, ExternalLink } from 'lucide-react'
import { useWalletConnection } from '@/hooks/useWalletConnection'

interface TokenGateProps {
    children: ReactNode
    showConnectButton?: boolean
}

export function TokenGate({ children, showConnectButton = true }: TokenGateProps) {
    const {
        isConnected,
        address,
        formattedBalance,
        isLoading,
        isError,
        hasTokenAccess,
        requiredBalance,
        refetch,
    } = useTokenGate()

    const disableOnchain = process.env.NEXT_PUBLIC_DISABLE_ONCHAIN_GATING === 'true'

    const { connectWallet, canConnect, isConnecting } = useWalletConnection()

    // State 1: Not connected - Show connect wallet prompt
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6">
                    <Wallet className="w-10 h-10 text-zinc-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display uppercase">
                    Connect your wallet
                </h3>
                <p className="text-zinc-400 font-mono text-sm max-w-md mb-8">
                    {disableOnchain ? (
                        <>You need to connect your wallet to continue.</>
                    ) : (
                        <>You need to connect your wallet and hold at least <span className="text-white font-bold">{requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span> to continue.</>
                    )}
                </p>

                {!showConnectButton ? (
                    <p className="-mt-2 mb-6 text-xs font-mono text-zinc-500">
                        Connect your wallet using the button in the top-right.
                    </p>
                ) : null}

                {showConnectButton ? (
                    <button
                        onClick={connectWallet}
                        disabled={!canConnect || isConnecting}
                        className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-bold font-mono uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                    >
                        <Wallet className="w-5 h-5" />
                        {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                ) : null}
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
                    Verifying access
                </h3>
                <p className="text-zinc-500 font-mono text-sm">
                    Checking your access...
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
                    Error verifying access
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

    const currentBalance = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
    }).format(Number.parseFloat(formattedBalance))

    // State 4: Insufficient token balance
    if (!hasTokenAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-amber-950 border border-amber-700 flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display uppercase">
                    Insufficient token balance
                </h3>
                <p className="text-zinc-400 font-mono text-sm max-w-md mb-6">
                    You need at least <span className="text-white font-bold">{requiredBalance} {TOKEN_GATE_CONFIG.tokenSymbol}</span> to apply.
                </p>

                {/* Balance display */}
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8 w-full max-w-sm">
                    <div className="text-xs font-mono text-zinc-500 uppercase mb-2">Your balance</div>
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

    // State 5: Full access - Show children (the form)
    return <>{children}</>
}
