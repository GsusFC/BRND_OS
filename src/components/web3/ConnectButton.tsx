'use client'

import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { Wallet, ChevronDown } from 'lucide-react'

interface ConnectButtonProps {
    className?: string
    variant?: 'default' | 'minimal'
}

export default function ConnectButton({ className = '', variant = 'default' }: ConnectButtonProps) {
    const { open } = useAppKit()
    const { address, isConnected } = useAppKitAccount()

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    if (isConnected && address) {
        return (
            <button
                onClick={() => open({ view: 'Account' })}
                className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-all duration-200 ${className}`}
            >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-mono text-sm text-zinc-300">
                    {truncateAddress(address)}
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-500" />
            </button>
        )
    }

    if (variant === 'minimal') {
        return (
            <button
                onClick={() => open()}
                className={`flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
            >
                <Wallet className="w-4 h-4" />
                <span>Connect</span>
            </button>
        )
    }

    return (
        <button
            onClick={() => open()}
            className={`group relative flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-green-900/20 hover:shadow-green-900/40 ${className}`}
        >
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    )
}

// Hook para usar en otros componentes
export function useWalletAuth() {
    const { open } = useAppKit()
    const { address, isConnected, status } = useAppKitAccount()

    return {
        address,
        isConnected,
        status,
        connect: () => open(),
        disconnect: () => open({ view: 'Account' })
    }
}
