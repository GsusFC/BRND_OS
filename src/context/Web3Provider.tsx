'use client'

import type { ReactNode } from 'react'

interface Web3ProviderProps {
    children: ReactNode
    cookies: string | null
}

/**
 * Temporary no-op provider for admin stability.
 * Disables wallet SDK initialization that can crash when network/trackers are blocked.
 */
export default function Web3Provider({ children }: Web3ProviderProps) {
    return <>{children}</>
}
