import { Search } from "@/components/ui/Search"
import { BrandsTable } from "@/components/dashboard/BrandsTable"
import { Suspense } from "react"
import Link from "next/link"
import clsx from "clsx"

export default async function BrandsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string
        page?: string
        status?: string
    }>
}) {
    const params = await searchParams
    const query = params?.query || ""
    const currentPage = Number(params?.page) || 1
    const status = params?.status || "active" // Default to active brands

    const tabs = [
        { name: "Active", value: "active" },
        { name: "Pending", value: "pending" },
        { name: "All", value: "all" },
    ]

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display">Brands</h1>
            </div>

            <div className="mt-8 flex flex-col gap-4">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-border">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.value}
                            href={`/dashboard/brands?status=${tab.value}${query ? `&query=${query}` : ""}`}
                            className={clsx(
                                "px-4 py-2 text-sm font-mono font-medium transition-colors border-b-2",
                                status === tab.value
                                    ? "border-white text-white"
                                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab.name}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                    <Search placeholder="Search brands..." />
                </div>
            </div>

            <Suspense key={query + currentPage + status} fallback={<BrandsTableSkeleton />}>
                <BrandsTable query={query} currentPage={currentPage} status={status} />
            </Suspense>
        </div>
    )
}

function BrandsTableSkeleton() {
    return (
        <div className="mt-6 flow-root">
            <div className="inline-block min-w-full align-middle">
                <div className="rounded-lg bg-surface p-2 md:pt-0">
                    <div className="h-96 animate-pulse bg-surface-hover rounded-md" />
                </div>
            </div>
        </div>
    )
}
