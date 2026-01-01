'use client'

import { wagmiAdapter, projectId, networks } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { base } from '@reown/appkit/networks'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

// Skip AppKit initialization if no project ID (for builds without Web3)
const isWeb3Enabled = Boolean(projectId)

// Set up metadata for BRND
const metadata = {
    name: 'BRND Admin',
    description: 'BRND Week Leaderboard - Admin Dashboard',
    url: 'https://cntr.brnd.land',
    icons: ['https://brndos.netlify.app/icon.png']
}

// Create the AppKit modal only if Web3 is enabled
if (isWeb3Enabled) {
    createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: [base, ...networks.filter(n => n.id !== base.id)],
        defaultNetwork: base,
        metadata,
        features: {
            analytics: true,
            email: false, // Disable email login, we use wallet only
            socials: false // Disable social logins through Reown
        },
        themeMode: 'dark',
        themeVariables: {
            '--w3m-color-mix': '#000000',
            '--w3m-color-mix-strength': 40,
            '--w3m-accent': '#22c55e', // Green accent to match BRND
            '--w3m-border-radius-master': '8px'
        }
    })
}

interface Web3ProviderProps {
    children: ReactNode
    cookies: string | null
}

export default function Web3Provider({ children, cookies }: Web3ProviderProps) {
    // If Web3 is not enabled, just render children without providers
    if (!isWeb3Enabled) {
        return <>{children}</>
    }

    const initialState = cookieToInitialState(
        wagmiAdapter.wagmiConfig as Config,
        cookies
    )

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
