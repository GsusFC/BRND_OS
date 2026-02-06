'use client'

import { wagmiAdapter, projectId, networks } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { base } from '@reown/appkit/networks'
import React, { useEffect, type ReactNode } from 'react'
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

// Track initialization state
let appKitInitialized = false

// Global error handlers to suppress WalletConnect/Coinbase connection errors
// These run before React and catch errors that would otherwise crash the app
if (typeof window !== 'undefined') {
    // Patch window.onerror
    const originalOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
        const msg = typeof message === 'string' ? message : ''
        if (msg.includes('Connection closed') ||
            msg.includes('WebSocket') ||
            msg.includes('walletconnect') ||
            msg.includes('coinbase')) {
            return true // Suppress the error
        }
        if (originalOnError) {
            return originalOnError(message, source, lineno, colno, error)
        }
        return false
    }

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const msg = event.reason?.message || String(event.reason || '')
        if (msg.includes('Connection closed') ||
            msg.includes('Failed to fetch') ||
            msg.includes('WebSocket') ||
            msg.includes('walletconnect') ||
            msg.includes('coinbase')) {
            event.preventDefault()
        }
    })

    // Patch console.error to suppress noisy errors
    const originalConsoleError = console.error
    console.error = (...args) => {
        const firstArg = String(args[0] || '')
        if (firstArg.includes('Connection closed') ||
            firstArg.includes('WebSocket') ||
            firstArg.includes('@walletconnect') ||
            firstArg.includes('@coinbase')) {
            return // Silently suppress
        }
        originalConsoleError.apply(console, args)
    }
}

// Safe initialization function
function initializeAppKit() {
    if (appKitInitialized) return
    if (!isWeb3Enabled) return
    if (typeof window === 'undefined') return
    if (typeof window.localStorage?.getItem !== 'function') return

    try {
        createAppKit({
            adapters: [wagmiAdapter],
            projectId,
            networks: [base, ...networks.filter(n => n.id !== base.id)],
            defaultNetwork: base,
            metadata,
            features: {
                analytics: false, // Disable to avoid ad blocker issues
                email: false,
                socials: false
            },
            // Exclude Coinbase Wallet - its SDK crashes when blocked by ad blockers
            excludeWalletIds: [
                'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa' // Coinbase Wallet
            ],
            themeMode: 'dark',
            themeVariables: {
                '--w3m-color-mix': '#000000',
                '--w3m-color-mix-strength': 40,
                '--w3m-accent': '#22c55e',
                '--w3m-border-radius-master': '8px'
            }
        })
        appKitInitialized = true
    } catch (error) {
        console.warn('[Web3Provider] AppKit init failed:', error)
    }
}

interface Web3ProviderProps {
    children: ReactNode
    cookies: string | null
}

export default function Web3Provider({ children, cookies }: Web3ProviderProps) {
    useEffect(() => {
        if (!isWeb3Enabled) return
        if (typeof window === 'undefined') return
        // Dashboard routes don't need wallet modal initialization and are the
        // most affected by blocked analytics/network scripts.
        if (window.location.pathname.startsWith('/dashboard')) return
        initializeAppKit()
    }, [])

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
