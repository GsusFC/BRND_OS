"use client"

import type { ReactNode } from "react"
import Web3Provider from "@/context/Web3Provider"

export function Web3ClientProvider({ children }: { children: ReactNode }) {
    return <Web3Provider cookies={null}>{children}</Web3Provider>
}
