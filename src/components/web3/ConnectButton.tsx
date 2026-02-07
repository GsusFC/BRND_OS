'use client'

import { Wallet } from 'lucide-react'
import { useWalletConnection } from '@/hooks/useWalletConnection'

interface ConnectButtonProps {
    className?: string
    variant?: 'default' | 'minimal'
    hideWhenDisconnected?: boolean
}

export default function ConnectButton({ className = '', variant = 'default', hideWhenDisconnected = false }: ConnectButtonProps) {
    const {
        address,
        isConnected,
        isConnecting,
        canConnect,
        connectWallet,
        disconnectWallet,
    } = useWalletConnection()

    const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    if (isConnected && address) {
        return (
            <button
                onClick={disconnectWallet}
                className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-all duration-200 ${className}`}
            >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-mono text-sm text-zinc-300">
                    {truncateAddress(address)}
                </span>
            </button>
        )
    }

    if (hideWhenDisconnected) {
        return null
    }

    if (variant === 'minimal') {
        return (
            <button
                onClick={connectWallet}
                disabled={!canConnect || isConnecting}
                className={`flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
            >
                <Wallet className="w-4 h-4" />
                <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
            </button>
        )
    }

    return (
        <button
            onClick={connectWallet}
            disabled={!canConnect || isConnecting}
            className={`flex items-center gap-3 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
        >
            <Wallet className="w-5 h-5" />
            <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
        </button>
    )
}

// Hook para usar en otros componentes
export function useWalletAuth() {
    const {
        address,
        isConnected,
        status,
        connectWallet,
        disconnectWallet,
    } = useWalletConnection()

    return {
        address,
        isConnected,
        status,
        connect: connectWallet,
        disconnect: disconnectWallet,
    }
}
