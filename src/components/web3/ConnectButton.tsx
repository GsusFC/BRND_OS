'use client'

import { QrCode, Wallet } from 'lucide-react'
import { useWalletConnection } from '@/hooks/useWalletConnection'
import { WalletConnectQrPopover } from '@/components/web3/WalletConnectQrPopover'

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
        hasInjectedProvider,
        hasWalletConnect,
        walletConnectUri,
        canConnect,
        errorMessage,
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

    // Show both options when injected provider + WalletConnect are available
    const showDualButtons = hasInjectedProvider && hasWalletConnect && variant === 'default'

    if (showDualButtons) {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void connectWallet('injected')}
                        disabled={!canConnect || isConnecting}
                        className={`flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
                    >
                        <Wallet className="w-4 h-4" />
                        <span>{isConnecting ? 'Connecting...' : 'Extension'}</span>
                    </button>
                    <button
                        onClick={() => void connectWallet('walletconnect')}
                        disabled={!canConnect || isConnecting}
                        title="Connect via QR code (Rainbow, Coinbase, etc.)"
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200"
                    >
                        <QrCode className="w-4 h-4" />
                        <span>{isConnecting ? 'Connecting...' : 'Mobile / QR'}</span>
                    </button>
                </div>
                {errorMessage ? <span className="text-[10px] font-mono text-red-400">{errorMessage}</span> : null}
                <WalletConnectQrPopover uri={walletConnectUri} showTrigger={false} />
            </div>
        )
    }

    if (variant === 'minimal') {
        return (
            <div className="flex flex-col items-end gap-1">
                <button
                    onClick={() => void connectWallet()}
                    disabled={!canConnect || isConnecting}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
                >
                    <Wallet className="w-4 h-4" />
                    <span>
                        {!canConnect ? 'Wallet Unavailable' : isConnecting ? 'Connecting...' : hasWalletConnect && !hasInjectedProvider ? 'Connect (QR)' : 'Connect'}
                    </span>
                </button>
                {errorMessage ? <span className="text-[10px] font-mono text-red-400">{errorMessage}</span> : null}
                <WalletConnectQrPopover uri={walletConnectUri} showTrigger={false} />
            </div>
        )
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <button
                onClick={() => void connectWallet()}
                disabled={!canConnect || isConnecting}
                className={`flex items-center gap-3 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-medium transition-all duration-200 ${className}`}
            >
                <Wallet className="w-5 h-5" />
                <span>
                    {!canConnect ? 'Wallet Unavailable' : isConnecting ? 'Connecting...' : hasWalletConnect && !hasInjectedProvider ? 'Connect Wallet (QR)' : 'Connect Wallet'}
                </span>
            </button>
            {errorMessage ? <span className="text-[10px] font-mono text-red-400">{errorMessage}</span> : null}
            <WalletConnectQrPopover uri={walletConnectUri} showTrigger={false} />
        </div>
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
