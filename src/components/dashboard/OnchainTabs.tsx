"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/Pagination"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { UpdateOnchainPanel } from "@/components/dashboard/UpdateOnchainPanel"
import { CreateOnchainPanel } from "@/components/dashboard/CreateOnchainPanel"
import ConnectButton from "@/components/web3/ConnectButton"
import { useAccount, useReadContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"

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
    const { address, isConnected } = useAccount()
    const { data: isAdmin, isError: isAdminError, isLoading: isAdminLoading } = useReadContract({
        address: BRND_CONTRACT_ADDRESS,
        abi: BRND_CONTRACT_ABI,
        functionName: "isAdmin",
        args: address ? [address] : undefined,
        query: { enabled: Boolean(address) },
    })
    const canUseTabs = isConnected && isAdmin === true
    const showConnect = !isConnected
    const showNotAdmin = isConnected && isAdmin === false
    const showAdminLoading = isConnected && isAdmin === undefined && !isAdminError

    const renderLockedState = () => (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <span className="text-2xl">🔒</span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Wallet required</h2>
            <p className="mt-2 text-sm font-mono text-zinc-400">
                {showConnect && "Connect an admin wallet to manage onchain brands."}
                {showNotAdmin && "This wallet is not authorized to manage onchain brands."}
                {showAdminLoading && "Checking admin permissions..."}
                {isAdminError && "Unable to verify admin permissions."}
            </p>
            {showConnect && (
                <div className="mt-6 flex justify-center">
                    <ConnectButton />
                </div>
            )}
        </div>
    )

    return (
        <div className="mt-8 space-y-6">
            {!canUseTabs && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white">Connect wallet</h2>
                            <p className="text-sm font-mono text-zinc-400">
                                {showConnect && "You need an admin wallet to access onchain actions."}
                                {showNotAdmin && "Wallet connected, but it is not an admin address."}
                                {showAdminLoading && "Checking admin permissions..."}
                                {isAdminError && "Unable to verify admin permissions."}
                            </p>
                        </div>
                        {showConnect && <ConnectButton />}
                    </div>
                </div>
            )}

            <Tabs
                defaultValue="pending"
                className="mt-0"
                onValueChange={(value) => setActiveTab(value)}
            >
                <TabsList>
                    <TabsTrigger value="pending" disabled={!canUseTabs}>Pending Onchain</TabsTrigger>
                    <TabsTrigger value="update" disabled={!canUseTabs}>Update Onchain</TabsTrigger>
                    <TabsTrigger value="create" disabled={!canUseTabs}>Create Onchain</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    {!canUseTabs ? renderLockedState() : (
                        <>
                            <p className="text-zinc-500 font-mono text-sm">
                                Review and approve new brand submissions to move them onchain for Season 2
                            </p>
                            <div className="mt-6">
                                <ApplicationsTable applications={applications} categories={categories} />
                            </div>
                            <Pagination totalPages={pendingTotalPages} />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="update" className="mt-6">
                    {!canUseTabs ? renderLockedState() : (
                        <div className="mt-6">
                            <UpdateOnchainPanel categories={categories} isActive={activeTab === "update"} />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="create" className="mt-6">
                    {!canUseTabs ? renderLockedState() : (
                        <div className="mt-6">
                            <CreateOnchainPanel categories={categories} isActive={activeTab === "create"} />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
