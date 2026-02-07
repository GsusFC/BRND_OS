'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function useWalletConnection() {
    const { address, isConnected, status } = useAccount()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()

    const connector = connectors[0]
    const canConnect = Boolean(connector)

    const connectWallet = () => {
        if (!connector) return
        connect({ connector })
    }

    const disconnectWallet = () => {
        disconnect()
    }

    return {
        address,
        isConnected,
        status: isPending ? 'connecting' : status,
        isConnecting: isPending,
        canConnect,
        connectWallet,
        disconnectWallet,
    }
}
