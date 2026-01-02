'use server'

import turso from '@/lib/turso'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-checks'
import { auth } from '@/auth'

interface AllowedWallet {
    id: number
    address: string
    label: string | null
    createdAt: string
    updatedAt: string
}

/**
 * Check if a wallet address is in the allowlist
 */
export async function isWalletAllowed(address: string): Promise<boolean> {
    if (!address) return false

    const normalizedAddress = address.toLowerCase()

    const result = await turso.execute({
        sql: 'SELECT id FROM allowed_wallets WHERE address = ?',
        args: [normalizedAddress],
    })

    return result.rows.length > 0
}

/**
 * Get all allowed wallets
 */
export async function getAllowedWallets(): Promise<AllowedWallet[]> {
    const result = await turso.execute(
        'SELECT id, address, label, createdAt, updatedAt FROM allowed_wallets ORDER BY createdAt DESC'
    )

    return result.rows.map(row => ({
        id: row.id as number,
        address: row.address as string,
        label: row.label as string | null,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
    }))
}

/**
 * Add a wallet to the allowlist
 */
export async function addAllowedWallet(formData: FormData) {
    try {
        await requireAdmin()
    } catch {
        return { error: 'Unauthorized' }
    }

    const address = formData.get('address') as string
    const label = formData.get('label') as string | null

    if (!address) {
        return { error: 'Wallet address is required' }
    }

    // Validate Ethereum address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!addressRegex.test(address)) {
        return { error: 'Invalid Ethereum address format' }
    }

    const normalizedAddress = address.toLowerCase()

    try {
        // Check if already exists
        const existing = await turso.execute({
            sql: 'SELECT id FROM allowed_wallets WHERE address = ?',
            args: [normalizedAddress],
        })

        if (existing.rows.length > 0) {
            return { error: 'Wallet already in allowlist' }
        }

        await turso.execute({
            sql: 'INSERT INTO allowed_wallets (address, label, createdAt, updatedAt) VALUES (?, ?, datetime("now"), datetime("now"))',
            args: [normalizedAddress, label || null],
        })

        revalidatePath('/dashboard/allowlist')
        return { success: true }
    } catch (error) {
        console.error('Error adding wallet:', error)
        return { error: 'Failed to add wallet' }
    }
}

/**
 * Remove a wallet from the allowlist
 */
export async function removeAllowedWallet(id: number) {
    try {
        await requireAdmin()
    } catch {
        return { error: 'Unauthorized' }
    }

    try {
        await turso.execute({
            sql: 'DELETE FROM allowed_wallets WHERE id = ?',
            args: [id],
        })

        revalidatePath('/dashboard/allowlist')
        return { success: true }
    } catch (error) {
        console.error('Error removing wallet:', error)
        return { error: 'Failed to remove wallet' }
    }
}

/**
 * Update wallet label
 */
export async function updateWalletLabel(id: number, label: string) {
    try {
        await requireAdmin()
    } catch {
        return { error: 'Unauthorized' }
    }

    try {
        await turso.execute({
            sql: 'UPDATE allowed_wallets SET label = ?, updatedAt = datetime("now") WHERE id = ?',
            args: [label, id],
        })

        revalidatePath('/dashboard/allowlist')
        return { success: true }
    } catch (error) {
        console.error('Error updating wallet:', error)
        return { error: 'Failed to update wallet' }
    }
}

/**
 * Get token gate settings
 */
export async function getTokenGateSettings() {
    const result = await turso.execute(
        "SELECT value FROM settings WHERE key = 'minTokenBalance' ORDER BY rowid DESC LIMIT 1"
    )
    
    if (result.rows.length === 0) {
        return { minTokenBalance: '10000000' } // Default 10M
    }
    
    return { minTokenBalance: result.rows[0].value as string }
}

/**
 * Update token gate settings
 */
export async function updateTokenGateSettings(formData: FormData) {
    const session = await auth()
    if (!session?.user) {
        return { error: 'Unauthorized' }
    }

    const minTokenBalanceRaw = formData.get('minTokenBalance')
    const minTokenBalance = typeof minTokenBalanceRaw === 'string' ? minTokenBalanceRaw.trim() : ''
    
    if (!minTokenBalance || isNaN(Number(minTokenBalance))) {
        return { error: 'Invalid token amount' }
    }

    const parsed = Number(minTokenBalance)
    if (!Number.isFinite(parsed)) {
        return { error: 'Invalid token amount' }
    }
    if (parsed < 0) {
        return { error: 'Invalid token amount' }
    }

    const normalized = String(Math.floor(parsed))
    
    try {
        await turso.execute("DELETE FROM settings WHERE key = 'minTokenBalance'")
        await turso.execute({
            sql: "INSERT INTO settings (key, value) VALUES ('minTokenBalance', ?)",
            args: [normalized],
        })

        const readBack = await turso.execute(
            "SELECT value FROM settings WHERE key = 'minTokenBalance' ORDER BY rowid DESC LIMIT 1"
        )
        const stored = readBack.rows[0]?.value as string | undefined
        if (stored !== normalized) {
            return { error: 'Failed to update settings' }
        }
        
        revalidatePath('/dashboard/allowlist')
        return { success: true }
    } catch (error) {
        console.error('Error updating settings:', error)
        return { error: 'Failed to update settings' }
    }
}
