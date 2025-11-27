import { Search } from "@/components/ui/Search"
import { UsersTable } from "@/components/dashboard/UsersTable"
import { Suspense } from "react"
import Link from "next/link"
import clsx from "clsx"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function UsersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string
        page?: string
        role?: string
        sort?: string
        order?: string
    }>
}) {
    const params = await searchParams
    const query = params?.query || ""
    const currentPage = Number(params?.page) || 1
    const role = params?.role || "all"
    const sortParam = params?.sort
    const sort = (sortParam === "username" || sortParam === "points" || sortParam === "createdAt") ? sortParam : "points"
    const order = (params?.order === "asc" || params?.order === "desc") ? params.order : "desc"

    const tabs = [
        { name: "All", value: "all" },
        { name: "Admins", value: "admin" },
        { name: "Users", value: "user" },
    ]

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display uppercase">Users</h1>
            </div>

            <div className="mt-8 flex flex-col gap-4">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-border">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.value}
                            href={`/dashboard/users?role=${tab.value}${query ? `&query=${query}` : ""}&page=1`}
                            className={clsx(
                                "px-4 py-2 text-sm font-mono font-medium transition-colors border-b-2",
                                role === tab.value
                                    ? "border-white text-white"
                                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab.name}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <Search placeholder="Search users..." />
                </div>
            </div>

            <Suspense key={query + currentPage + role + sort + order} fallback={<UsersTableSkeleton />}>
                <UsersTable 
                    query={query} 
                    currentPage={currentPage} 
                    role={role}
                    sort={sort}
                    order={order}
                />
            </Suspense>
        </div>
    )
}

function UsersTableSkeleton() {
    return (
        <div className="mt-6 flow-root">
            {/* Skeleton del contador */}
            <div className="mb-4">
                <div className="h-5 w-48 animate-pulse bg-zinc-800 rounded" />
            </div>
            
            {/* Skeleton de la tabla */}
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    {/* Header skeleton */}
                    <div className="flex gap-4 py-4 px-6 border-b border-zinc-900">
                        <div className="h-3 w-16 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-14 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-10 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-14 animate-pulse bg-zinc-800 rounded" />
                    </div>
                    
                    {/* Rows skeleton */}
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-4 px-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="h-8 w-8 animate-pulse bg-zinc-800 rounded-full" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-28 animate-pulse bg-zinc-800 rounded" />
                                    <div className="h-2.5 w-16 animate-pulse bg-zinc-900 rounded" />
                                </div>
                            </div>
                            <div className="h-5 w-16 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-5 w-14 animate-pulse bg-zinc-800 rounded-full" />
                            <div className="h-5 w-20 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-8 w-8 animate-pulse bg-zinc-800 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
