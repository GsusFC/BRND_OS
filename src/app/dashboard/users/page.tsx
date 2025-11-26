import { Search } from "@/components/ui/Search"
import { UsersTable } from "@/components/dashboard/UsersTable"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

export default async function UsersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string
        page?: string
    }>
}) {
    const params = await searchParams
    const query = params?.query || ""
    const currentPage = Number(params?.page) || 1

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display">Users</h1>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
                <Search placeholder="Search users..." />
            </div>
            <Suspense key={query + currentPage} fallback={<UsersTableSkeleton />}>
                <UsersTable query={query} currentPage={currentPage} />
            </Suspense>
        </div>
    )
}

function UsersTableSkeleton() {
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
