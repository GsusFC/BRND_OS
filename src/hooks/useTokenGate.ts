'use client'

import { useEffect, useState, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import { useAppKitAccount } from '@reown/appkit/react'
import { formatUnits } from 'viem'
import {
    TOKEN_GATE_CONFIG,
    ERC20_ABI,
} from '@/config/tokengate'
import { isWalletAllowed } from '@/lib/actions/wallet-actions'

export interface TokenGateStatus {
    // Connection state
    isConnected: boolean
    address: `0x${string}` | undefined

    // Token balance state
    balance: bigint | undefined
    formattedBalance: string
    isLoading: boolean
    isError: boolean

    // Allowlist state
    isAllowlisted: boolean
    isCheckingAllowlist: boolean

    // Gate status
    hasTokenAccess: boolean
    hasFullAccess: boolean
    requiredBalance: string

    // Refetch function
    refetch: () => void
}

export function useTokenGate(): TokenGateStatus {
    const { address, isConnected } = useAppKitAccount()
    const [isAllowlisted, setIsAllowlisted] = useState(false)
    const [isCheckingAllowlist, setIsCheckingAllowlist] = useState(false)
    const [minTokenBalance, setMinTokenBalance] = useState<bigint>(BigInt(10_000_000))
    const [isLoadingSettings, setIsLoadingSettings] = useState(true)

    const disableOnchain = process.env.NEXT_PUBLIC_DISABLE_ONCHAIN_GATING === 'true'

    // Fetch token gate settings from API
    useEffect(() => {
        fetch('/api/tokengate/settings', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                setMinTokenBalance(BigInt(data.minTokenBalance || '10000000'))
            })
            .catch(console.error)
            .finally(() => setIsLoadingSettings(false))
    }, [])

    // Calculate min balance with decimals
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

    // Check allowlist status
    const checkAllowlist = useCallback(async () => {
        if (!address) {
            setIsAllowlisted(false)
            return
        }

        setIsCheckingAllowlist(true)
        try {
            const allowed = await isWalletAllowed(address)
            setIsAllowlisted(allowed)
        } catch (error) {
            console.error('Error checking allowlist:', error)
            setIsAllowlisted(false)
        } finally {
            setIsCheckingAllowlist(false)
        }
    }, [address])

    // Check allowlist when address changes
    useEffect(() => {
        if (isConnected && address) {
            checkAllowlist()
        } else {
            setIsAllowlisted(false)
        }
    }, [isConnected, address, checkAllowlist])

    // Format balance for display
    const formattedBalance = balance
        ? formatUnits(balance, TOKEN_GATE_CONFIG.decimals)
        : '0'

    // Check if user has enough tokens
    const hasTokenAccess = disableOnchain
        ? true
        : balance !== undefined && balance >= minBalanceWithDecimals

    // Full access requires both token balance AND allowlist
    const hasFullAccess = hasTokenAccess && isAllowlisted

    // Format required balance for display (avoid Number() on bigint)
    const requiredBalance = new Intl.NumberFormat('en-US').format(minTokenBalance)

    // Combined loading state
    const isLoading = (disableOnchain ? false : isLoadingBalance) || isCheckingAllowlist || isLoadingSettings

    // Combined refetch
    const refetch = useCallback(() => {
        if (!disableOnchain) {
            refetchBalance()
        }
        checkAllowlist()
    }, [disableOnchain, refetchBalance, checkAllowlist])

    return {
        isConnected,
        address: isConnected ? (address as `0x${string}` | undefined) : undefined,
        balance,
        formattedBalance,
        isLoading,
        isError: disableOnchain ? false : isError,
        isAllowlisted,
        isCheckingAllowlist,
        hasTokenAccess,
        hasFullAccess,
        requiredBalance,
        refetch,
    }
}
