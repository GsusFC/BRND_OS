'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * Check if a wallet address is in the allowlist
 */
export async function isWalletAllowed(address: string): Promise<boolean> {
    if (!address) return false

    const normalizedAddress = address.toLowerCase()

    const wallet = await prisma.allowedWallet.findFirst({
        where: {
            address: {
                equals: normalizedAddress,
            },
        },
    })

    return wallet !== null
}

/**
 * Get all allowed wallets
 */
export async function getAllowedWallets() {
    return prisma.allowedWallet.findMany({
        orderBy: { createdAt: 'desc' },
    })
}

/**
 * Add a wallet to the allowlist
 */
export async function addAllowedWallet(formData: FormData) {
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
        const existing = await prisma.allowedWallet.findFirst({
            where: { address: normalizedAddress },
        })

        if (existing) {
            return { error: 'Wallet already in allowlist' }
        }

        await prisma.allowedWallet.create({
            data: {
                address: normalizedAddress,
                label: label || null,
            },
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
        await prisma.allowedWallet.delete({
            where: { id },
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
        await prisma.allowedWallet.update({
            where: { id },
            data: { label },
        })

        revalidatePath('/dashboard/allowlist')
        return { success: true }
    } catch (error) {
        console.error('Error updating wallet:', error)
        return { error: 'Failed to update wallet' }
    }
}
