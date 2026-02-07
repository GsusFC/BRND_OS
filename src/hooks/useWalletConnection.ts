'use client'

import { useCallback, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function useWalletConnection() {
    const { address, isConnected, status } = useAccount()
    const { connectAsync, connectors, isPending, error: connectError } = useConnect()
    const { disconnect } = useDisconnect()
    const [localError, setLocalError] = useState<string | null>(null)

    const hasInjectedProvider =
        typeof window !== 'undefined' && typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined'

    const connector = useMemo(() => {
        if (!hasInjectedProvider) return undefined
        return connectors.find((item) => item.id === 'injected') ?? connectors[0]
    }, [connectors, hasInjectedProvider])

    const canConnect = Boolean(connector && hasInjectedProvider)

    const connectWallet = useCallback(async () => {
        setLocalError(null)
        if (!connector) {
            setLocalError('No wallet extension detected in this browser.')
            return false
        }
        try {
            await connectAsync({ connector })
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Wallet connection failed.'
            setLocalError(message)
            return false
        }
    }, [connector, connectAsync])

    const disconnectWallet = useCallback(() => {
        setLocalError(null)
        disconnect()
    }, [disconnect])

    const errorMessage = localError ?? connectError?.message ?? null

    return {
        address,
        isConnected,
        status: isPending ? 'connecting' : status,
        isConnecting: isPending,
        hasInjectedProvider,
        canConnect,
        errorMessage,
        connectWallet,
        disconnectWallet,
    }
}
