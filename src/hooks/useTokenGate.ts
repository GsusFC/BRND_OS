'use client'

import { useReadContract } from 'wagmi'
import { useAppKitAccount } from '@reown/appkit/react'
import { formatUnits } from 'viem'
import {
    TOKEN_GATE_CONFIG,
    MIN_BALANCE_WITH_DECIMALS,
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
    hasAccess: boolean
    requiredBalance: string

    // Refetch function
    refetch: () => void
}

export function useTokenGate(): TokenGateStatus {
    const { address, isConnected } = useAppKitAccount()

    // Read token balance
    const {
        data: balance,
        isLoading,
        isError,
        refetch,
    } = useReadContract({
        address: TOKEN_GATE_CONFIG.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
        chainId: TOKEN_GATE_CONFIG.chainId,
        query: {
            enabled: isConnected && !!address,
            refetchInterval: 30000, // Refetch every 30 seconds
        },
    })

    // Format balance for display
    const formattedBalance = balance
        ? formatUnits(balance, TOKEN_GATE_CONFIG.decimals)
        : '0'

    // Check if user has enough tokens
    const hasAccess = balance !== undefined && balance >= MIN_BALANCE_WITH_DECIMALS

    // Format required balance for display
    const requiredBalance = TOKEN_GATE_CONFIG.minBalance.toLocaleString()

    return {
        isConnected,
        address: address as `0x${string}` | undefined,
        balance,
        formattedBalance,
        isLoading,
        isError,
        hasAccess,
        requiredBalance,
        refetch,
    }
}
