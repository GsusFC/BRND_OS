"use client"

import type { ReactNode } from "react"
import { Coins, ImageIcon, Info, MessageSquare, Table2, Wallet } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type BrandFormTabsProps = {
    value: string
    onValueChange: (value: string) => void
    children: ReactNode
    className?: string
    listClassName?: string
}

export function BrandFormTabs({
    value,
    onValueChange,
    children,
    className,
    listClassName,
}: BrandFormTabsProps) {
    return (
        <Tabs value={value} onValueChange={onValueChange} className={cn("space-y-6", className)}>
            <TabsList className={cn("w-fit mx-auto", listClassName)}>
                <TabsTrigger value="farcaster" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Farcaster
                </TabsTrigger>
                <TabsTrigger value="sheet" className="gap-2">
                    <Table2 className="h-4 w-4" />
                    Sheet
                </TabsTrigger>
                <TabsTrigger value="basic" className="gap-2">
                    <Info className="h-4 w-4" />
                    Basic
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Media
                </TabsTrigger>
                <TabsTrigger value="wallet" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallet
                </TabsTrigger>
                <TabsTrigger value="token" className="gap-2">
                    <Coins className="h-4 w-4" />
                    Token
                </TabsTrigger>
            </TabsList>
            {children}
        </Tabs>
    )
}
