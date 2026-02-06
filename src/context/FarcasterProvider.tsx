'use client'

import type { ReactNode } from 'react'

interface FarcasterProviderProps {
    children: ReactNode
}

/**
 * Temporary no-op provider for admin stability.
 * Avoids client SDK calls that may fail in strict/ad-blocked environments.
 */
export default function FarcasterProvider({ children }: FarcasterProviderProps) {
    return <>{children}</>
}
