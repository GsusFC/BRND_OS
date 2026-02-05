"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/Pagination"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { UpdateOnchainPanel } from "@/components/dashboard/UpdateOnchainPanel"
import { CreateOnchainPanel } from "@/components/dashboard/CreateOnchainPanel"

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
    const [searchQuery, setSearchQuery] = useState("")

    const filteredApplications = useMemo(() => {
        if (!searchQuery.trim()) return applications

        const query = searchQuery.toLowerCase().trim()
        return applications.filter((app) => {
            const name = app.name?.toLowerCase() || ""
            const description = app.description?.toLowerCase() || ""
            const channel = app.channel?.toLowerCase() || ""
            const profile = app.profile?.toLowerCase() || ""
            const category = app.category?.name?.toLowerCase() || ""
            return (
                name.includes(query) ||
                description.includes(query) ||
                channel.includes(query) ||
                profile.includes(query) ||
                category.includes(query)
            )
        })
    }, [applications, searchQuery])

    return (
        <div className="mt-8 space-y-6">
            <Tabs
                defaultValue="pending"
                className="mt-0"
                onValueChange={(value) => setActiveTab(value)}
            >
                <TabsList>
                    <TabsTrigger value="pending">Pending Onchain</TabsTrigger>
                    <TabsTrigger value="update">Update Onchain</TabsTrigger>
                    <TabsTrigger value="create">Create Onchain</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <p className="text-zinc-500 font-mono text-sm">
                            Review and approve new brand submissions to move them onchain
                        </p>
                        {applications.length > 0 && (
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search applications..."
                                    className="pl-10 pr-10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {searchQuery && (
                        <p className="mt-2 text-xs text-zinc-600 font-mono">
                            Showing {filteredApplications.length} of {applications.length} applications
                        </p>
                    )}

                    <div className="mt-6">
                        <ApplicationsTable applications={filteredApplications} categories={categories} />
                    </div>

                    {!searchQuery && <Pagination totalPages={pendingTotalPages} />}
                </TabsContent>

                <TabsContent value="update" className="mt-6">
                    <div className="mt-6">
                        <UpdateOnchainPanel categories={categories} isActive={activeTab === "update"} />
                    </div>
                </TabsContent>

                <TabsContent value="create" className="mt-6">
                    <div className="mt-6">
                        <CreateOnchainPanel categories={categories} isActive={activeTab === "create"} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
