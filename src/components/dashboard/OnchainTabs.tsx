"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/Pagination"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { UpdateOnchainPanel } from "@/components/dashboard/UpdateOnchainPanel"

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
