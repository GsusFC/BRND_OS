"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/Pagination"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { UpdateOnchainPanel } from "@/components/dashboard/UpdateOnchainPanel"
import ConnectButton from "@/components/web3/ConnectButton"
import { useAccount } from "wagmi"

type Application = Parameters<typeof ApplicationsTable>[0]["applications"][number]
type CategoryOption = Parameters<typeof ApplicationsTable>[0]["categories"][number]

export function OnchainTabs({
    applications,
    categories,
    pendingTotalPages,
}: {
    applications: Application[]
    categories: CategoryOption[]
    pendingTotalPages: number
}) {
    const [activeTab, setActiveTab] = useState("pending")
    const { isConnected } = useAccount()

    if (!isConnected) {
        return (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <span className="text-2xl">🔒</span>
                </div>
                <h2 className="mt-4 text-xl font-bold text-white">Connect your wallet to manage brands</h2>
                <p className="mt-2 text-sm font-mono text-zinc-400">
                    You need an admin wallet connected to review, approve, or update onchain brands.
                </p>
                <div className="mt-6 flex justify-center">
                    <ConnectButton />
                </div>
            </div>
        )
    }

    return (
        <Tabs
            defaultValue="pending"
            className="mt-8"
            onValueChange={(value) => setActiveTab(value)}
        >
            <TabsList>
                <TabsTrigger value="pending">Pending Onchain</TabsTrigger>
                <TabsTrigger value="update">Update Onchain</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
                <p className="text-zinc-500 font-mono text-sm">
                    Review and approve new brand submissions to move them onchain for Season 2
                </p>
                <div className="mt-6">
                    <ApplicationsTable applications={applications} categories={categories} />
                </div>
                <Pagination totalPages={pendingTotalPages} />
            </TabsContent>

            <TabsContent value="update" className="mt-6">
                <div className="mt-6">
                    <UpdateOnchainPanel categories={categories} isActive={activeTab === "update"} />
                </div>
            </TabsContent>
        </Tabs>
    )
}
