'use client'

import '@farcaster/auth-kit/styles.css'
import { AuthKitProvider } from '@farcaster/auth-kit'
import { ReactNode } from 'react'

const config = {
    rpcUrl: 'https://mainnet.optimism.io',
    domain: typeof window !== 'undefined' ? window.location.host : 'brndos.netlify.app',
}

interface FarcasterProviderProps {
    children: ReactNode
}

export default function FarcasterProvider({ children }: FarcasterProviderProps) {
    return (
        <AuthKitProvider config={config}>
            {children}
        </AuthKitProvider>
    )
}
