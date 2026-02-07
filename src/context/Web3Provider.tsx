'use client'

import { wagmiConfig } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

interface Web3ProviderProps {
    children: ReactNode
    cookies: string | null
}

const queryClient = new QueryClient()

export default function Web3Provider({ children, cookies }: Web3ProviderProps) {
    const initialState = cookieToInitialState(
        wagmiConfig as Config,
        cookies
    )

    return (
        <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
