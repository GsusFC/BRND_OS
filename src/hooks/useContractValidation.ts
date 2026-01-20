"use client"

import { useEffect, useState } from "react"
import { isAddress } from "viem"
import { usePublicClient } from "wagmi"

export function useContractValidation(address: string) {
    const [isValid, setIsValid] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const client = usePublicClient()

    useEffect(() => {
        if (!client) {
            setIsValid(false)
            setIsLoading(false)
            return
        }
        if (!address || !isAddress(address)) {
            setIsValid(false)
            setIsLoading(false)
            return
        }

        setIsLoading(true)

        client
            .getBytecode({ address: address as `0x${string}` })
            .then((bytecode) => {
                setIsValid(Boolean(bytecode && bytecode !== "0x"))
            })
            .catch(() => {
                setIsValid(false)
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [address, client])

    return { isValid, isLoading }
}
