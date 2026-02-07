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
        const injectedConnector = connectors.find((item) => item.id === 'injected')
        const walletConnectConnector = connectors.find((item) => item.id === 'walletConnect')
        if (hasInjectedProvider && injectedConnector) return injectedConnector
        return walletConnectConnector ?? injectedConnector ?? connectors[0]
    }, [connectors, hasInjectedProvider])

    const connectionMethod = useMemo<'injected' | 'walletconnect' | 'unknown'>(() => {
        if (!connector) return 'unknown'
        if (connector.id === 'walletConnect') return 'walletconnect'
        if (connector.id === 'injected') return 'injected'
        return 'unknown'
    }, [connector])

    const canConnect = Boolean(connector)

    const connectWallet = useCallback(async () => {
        setLocalError(null)
        if (!connector) {
            setLocalError('No wallet connector available.')
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
        connectionMethod,
        canConnect,
        errorMessage,
        connectWallet,
        disconnectWallet,
    }
}
