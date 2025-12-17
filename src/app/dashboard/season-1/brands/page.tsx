import { Search } from "@/components/ui/Search"
import { BrandsTable } from "@/components/dashboard/BrandsTable"
import { CategoryFilter } from "@/components/ui/CategoryFilter"
import { Suspense } from "react"
import Link from "next/link"
import clsx from "clsx"
import prisma from "@/lib/prisma"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const BASE_PATH = "/dashboard/season-1"

export default async function Season1BrandsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string
        page?: string
        status?: string
        category?: string
        sort?: string
        order?: string
    }>
}) {
    const params = await searchParams
    const query = params?.query || ""
    const currentPage = Number(params?.page) || 1
    const status = params?.status || "active"
    const categoryId = params?.category ? Number(params.category) : undefined
    const sortParam = params?.sort
    const sort = (sortParam === "name" || sortParam === "score") ? sortParam : "score"
    const order = (params?.order === "asc" || params?.order === "desc") ? params.order : "desc"

    const categories = await prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    const tabs = [
        { name: "Active", value: "active" },
        { name: "Pending", value: "pending" },
        { name: "All", value: "all" },
    ]

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white font-display uppercase">Brands</h1>
                    <p className="text-zinc-500 font-mono text-sm mt-1">Season 1 • Legacy</p>
                </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-border">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.value}
                            href={`${BASE_PATH}/brands?status=${tab.value}${query ? `&query=${query}` : ""}&page=1`}
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

                <div className="flex items-center gap-4">
                    <Search placeholder="Search brands..." />
                    <CategoryFilter categories={categories} />
                </div>
            </div>

            <Suspense key={query + currentPage + status + categoryId + sort + order} fallback={<BrandsTableSkeleton />}>
                <BrandsTable 
                    query={query} 
                    currentPage={currentPage} 
                    status={status}
                    categoryId={categoryId}
                    sort={sort}
                    order={order}
                />
            </Suspense>
        </div>
    )
}

function BrandsTableSkeleton() {
    return (
        <div className="mt-6 flow-root">
            <div className="mb-4">
                <div className="h-5 w-48 animate-pulse bg-zinc-800 rounded" />
            </div>
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    <div className="flex gap-4 py-4 px-6 border-b border-zinc-900">
                        <div className="h-3 w-20 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-16 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-12 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-14 animate-pulse bg-zinc-800 rounded" />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-4 px-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="h-8 w-8 animate-pulse bg-zinc-800 rounded-lg" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-32 animate-pulse bg-zinc-800 rounded" />
                                    <div className="h-2.5 w-16 animate-pulse bg-zinc-900 rounded" />
                                </div>
                            </div>
                            <div className="h-5 w-20 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-5 w-16 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-5 w-14 animate-pulse bg-zinc-800 rounded-full" />
                            <div className="h-8 w-16 animate-pulse bg-zinc-800 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
