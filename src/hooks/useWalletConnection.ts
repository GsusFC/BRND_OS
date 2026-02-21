'use client'

import { useCallback, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, type Connector } from 'wagmi'

type ConnectionMethod = 'walletconnect' | 'injected' | 'unknown'

const CONNECT_TIMEOUT_MS = {
    walletconnect: 60000,
    injected: 15000,
}

const isUserRejectedError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return (
        message.includes('user rejected') ||
        message.includes('user denied') ||
        message.includes('request rejected') ||
        message.includes('user cancelled') ||
        message.includes('user canceled')
    )
}

const resolveConnectionMethod = (connector?: Connector): ConnectionMethod => {
    if (!connector) return 'unknown'
    if (connector.id === 'walletConnect') return 'walletconnect'
    if (connector.id === 'injected') return 'injected'
    return 'unknown'
}

export function useWalletConnection() {
    const { address, isConnected, status } = useAccount()
    const { connectAsync, connectors, error: connectError } = useConnect()
    const { disconnect } = useDisconnect()
    const [localError, setLocalError] = useState<string | null>(null)
    const [isConnectingLocal, setIsConnectingLocal] = useState(false)
    const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null)

    const hasInjectedProvider =
        typeof window !== 'undefined' && typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined'

    const connectorByMethod = useMemo(() => {
        const injectedConnector = connectors.find((item) => item.id === 'injected')
        const walletConnectConnector = connectors.find((item) => item.id === 'walletConnect')

        return {
            walletconnect: walletConnectConnector,
            injected: hasInjectedProvider ? injectedConnector : undefined,
        }
    }, [connectors, hasInjectedProvider])

    const preferredConnector = useMemo(
        () => connectorByMethod.injected ?? connectorByMethod.walletconnect ?? connectors[0],
        [connectorByMethod, connectors],
    )

    const connectionMethod = useMemo<ConnectionMethod>(() => resolveConnectionMethod(preferredConnector), [preferredConnector])
    const canConnect = Boolean(preferredConnector)

    const connectWallet = useCallback(async () => {
        setLocalError(null)
        setWalletConnectUri(null)
        if (!preferredConnector) {
            setLocalError('No wallet connector available.')
            return false
        }

        const candidates = [
            connectorByMethod.injected,
            connectorByMethod.walletconnect,
            preferredConnector,
        ].filter((item, index, arr): item is Connector => Boolean(item) && arr.findIndex((candidate) => candidate?.id === item?.id) === index)

        setIsConnectingLocal(true)
        try {
            let lastMessage: string | null = null
            for (const candidate of candidates) {
                let unsubscribeDisplayUri: (() => void) | undefined
                try {
                    const timeoutMs = candidate.id === 'walletConnect' ? CONNECT_TIMEOUT_MS.walletconnect : CONNECT_TIMEOUT_MS.injected
                    const timeoutMessage =
                        candidate.id === 'walletConnect'
                            ? 'WalletConnect timeout. Disable adblock/tracking protection and allow pulse.walletconnect.org, relay.walletconnect.com, and wc.googleusercontent.com.'
                            : 'Wallet connection timeout. Check popup/modal permissions and retry.'

                    if (candidate.id === 'walletConnect' && typeof candidate.getProvider === 'function') {
                        const provider = (await candidate.getProvider()) as {
                            on?: (event: string, listener: (uri: string) => void) => void
                            removeListener?: (event: string, listener: (uri: string) => void) => void
                        } | null
                        const onDisplayUri = (uri: string) => {
                            setWalletConnectUri(uri)
                        }
                        provider?.on?.('display_uri', onDisplayUri)
                        unsubscribeDisplayUri = () => {
                            provider?.removeListener?.('display_uri', onDisplayUri)
                        }
                    }

                    await Promise.race([
                        connectAsync({ connector: candidate }),
                        new Promise((_, reject) =>
                            setTimeout(
                                () => reject(new Error(timeoutMessage)),
                                timeoutMs,
                            ),
                        ),
                    ])
                    setWalletConnectUri(null)
                    return true
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Wallet connection failed.'
                    lastMessage = message
                    if (isUserRejectedError(error)) {
                        setLocalError(message)
                        return false
                    }
                } finally {
                    unsubscribeDisplayUri?.()
                }
            }

            setLocalError(lastMessage ?? 'Wallet connection failed.')
            return false
        } finally {
            setIsConnectingLocal(false)
        }
    }, [connectAsync, connectorByMethod, preferredConnector])

    const disconnectWallet = useCallback(() => {
        setLocalError(null)
        setWalletConnectUri(null)
        disconnect()
    }, [disconnect])

    const errorMessage = localError ?? connectError?.message ?? null

    return {
        address,
        isConnected,
        status: isConnectingLocal ? 'connecting' : status,
        isConnecting: isConnectingLocal,
        hasInjectedProvider,
        connectionMethod,
        walletConnectUri,
        canConnect,
        errorMessage,
        connectWallet,
        disconnectWallet,
    }
}
