'use client'

import '@farcaster/auth-kit/styles.css'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { AuthKitProvider } from '@farcaster/auth-kit'

interface FarcasterProviderProps {
    children: ReactNode
}

export default function FarcasterProvider({ children }: FarcasterProviderProps) {
    const config = useMemo(() => {
        const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const origin =
            typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : defaultOrigin

        const domain =
            typeof window !== 'undefined' && window.location?.host
                ? window.location.host
                : new URL(defaultOrigin).host

        return {
            rpcUrl: process.env.NEXT_PUBLIC_FARCASTER_RPC_URL ?? 'https://mainnet.optimism.io',
            relay: process.env.NEXT_PUBLIC_FARCASTER_RELAY_URL ?? 'https://relay.farcaster.xyz',
            domain,
            siweUri: `${origin}/login`,
        }
    }, [])

    return <AuthKitProvider config={config}>{children}</AuthKitProvider>
}
