'use client'

import { Wallet } from 'lucide-react'

interface ConnectButtonProps {
    className?: string
    variant?: 'default' | 'minimal'
    hideWhenDisconnected?: boolean
}

export default function ConnectButton({ className = '', variant = 'default', hideWhenDisconnected = false }: ConnectButtonProps) {
    if (hideWhenDisconnected) {
        return null
    }

    if (variant === 'minimal') {
        return (
            <div className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl font-medium ${className}`}>
                <Wallet className="w-4 h-4" />
                <span>Wallet Disabled</span>
            </div>
        )
    }

    return (
        <div
            className={`flex items-center gap-3 px-6 py-3 bg-zinc-800 text-zinc-200 rounded-xl font-medium ${className}`}
        >
            <Wallet className="w-5 h-5" />
            <span>Wallet Disabled</span>
        </div>
    )
}

// Hook para usar en otros componentes
export function useWalletAuth() {
    return {
        address: undefined,
        isConnected: false,
        status: 'disconnected',
        connect: () => void 0,
        disconnect: () => void 0,
    }
}
