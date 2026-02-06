'use client'

import { wagmiAdapter, projectId, networks } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { base } from '@reown/appkit/networks'
import React, { type ReactNode, Component, type ErrorInfo } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Error boundary to catch Web3 initialization errors (e.g., from ad blockers)
class Web3ErrorBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode; fallback: ReactNode }) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.warn('[Web3ErrorBoundary] Caught error:', error.message, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback
        }
        return this.props.children
    }
}

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

const canInitWeb3 =
    isWeb3Enabled &&
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function"

// Create the AppKit modal only if Web3 is enabled (client-side)
// Wrapped in try-catch to handle cases where ad blockers block WalletConnect/Coinbase
if (canInitWeb3) {
    try {
        createAppKit({
            adapters: [wagmiAdapter],
            projectId,
            networks: [base, ...networks.filter(n => n.id !== base.id)],
            defaultNetwork: base,
            metadata,
            features: {
                analytics: false, // Disable analytics to avoid ad blocker issues
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
    } catch (error) {
        console.warn('[Web3Provider] Failed to initialize AppKit (ad blocker may be active):', error)
    }
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
        <Web3ErrorBoundary fallback={<>{children}</>}>
            <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </WagmiProvider>
        </Web3ErrorBoundary>
    )
}
