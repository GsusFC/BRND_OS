'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import {
    TOKEN_GATE_CONFIG,
    ERC20_ABI,
} from '@/config/tokengate'

export interface TokenGateStatus {
    // Connection state
    isConnected: boolean
    address: `0x${string}` | undefined

    // Token balance state
    balance: bigint | undefined
    formattedBalance: string
    isLoading: boolean
    isError: boolean

    // Gate status
    hasTokenAccess: boolean
    requiredBalance: string

    // Refetch function
    refetch: () => void
}

export function useTokenGate(): TokenGateStatus {
    const { address, isConnected } = useAccount()
    const [minTokenBalance, setMinTokenBalance] = useState<bigint>(TOKEN_GATE_CONFIG.minBalance)
    const [isLoadingSettings, setIsLoadingSettings] = useState(true)

    const disableOnchain = process.env.NEXT_PUBLIC_DISABLE_ONCHAIN_GATING === 'true'

    const fetchSettings = useCallback(async () => {
        if (disableOnchain) {
            setIsLoadingSettings(false)
            return
        }

        try {
            const res = await fetch('/api/tokengate/settings', { cache: 'no-store' })
            const data = (await res.json()) as { minTokenBalance?: string }
            setMinTokenBalance(BigInt(data.minTokenBalance || String(TOKEN_GATE_CONFIG.minBalance)))
        } catch (error) {
            console.error(error)
            setMinTokenBalance(TOKEN_GATE_CONFIG.minBalance)
        } finally {
            setIsLoadingSettings(false)
        }
    }, [disableOnchain])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const minBalanceWithDecimals = minTokenBalance * (BigInt(10) ** BigInt(TOKEN_GATE_CONFIG.decimals))

    // Read token balance
    const {
        data: balance,
        isLoading: isLoadingBalance,
        isError,
        refetch: refetchBalance,
    } = useReadContract({
        address: TOKEN_GATE_CONFIG.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
        chainId: TOKEN_GATE_CONFIG.chainId,
        query: {
            enabled: isConnected && !!address && !disableOnchain,
            refetchInterval: 30000, // Refetch every 30 seconds
        },
    })

    const formattedBalance = balance
        ? formatUnits(balance, TOKEN_GATE_CONFIG.decimals)
        : '0'

    // Check if user has enough tokens
    const hasTokenAccess = disableOnchain
        ? true
        : balance !== undefined && balance >= minBalanceWithDecimals

    // Format required balance for display (avoid Number() on bigint)
    const requiredBalance = new Intl.NumberFormat('en-US').format(minTokenBalance)

    // Combined loading state
    const isLoading = (disableOnchain ? false : isLoadingBalance) || isLoadingSettings

    // Combined refetch
    const refetch = useCallback(() => {
        if (!disableOnchain) {
            refetchBalance()
        }
        fetchSettings()
    }, [disableOnchain, fetchSettings, refetchBalance])

    return {
        isConnected,
        address: isConnected ? (address as `0x${string}` | undefined) : undefined,
        balance,
        formattedBalance,
        isLoading,
        isError: disableOnchain ? false : isError,
        hasTokenAccess,
        requiredBalance,
        refetch,
    }
}
