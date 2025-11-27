import { Search } from "@/components/ui/Search"
import { AirdropTable, AirdropStats } from "@/components/dashboard/AirdropComponents"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

export default async function AirdropPage({
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
            <div className="flex w-full items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black text-white font-display uppercase">Airdrop Simulation</h1>
                    <p className="text-zinc-500 mt-1 text-sm">Manage and simulate token distribution based on user scores.</p>
                </div>
                <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-white hover:bg-surface-hover hover:border-zinc-600 transition-all font-mono uppercase tracking-wide">
                    Run Simulation
                </button>
            </div>

            <Suspense fallback={<div className="h-32 animate-pulse bg-surface rounded-xl mb-8" />}>
                <AirdropStats />
            </Suspense>

            <div className="mt-8 flex items-center justify-between gap-2">
                <Search placeholder="Search users..." />
            </div>

            <Suspense key={query + currentPage} fallback={<AirdropTableSkeleton />}>
                <AirdropTable query={query} currentPage={currentPage} />
            </Suspense>
        </div>
    )
}

function AirdropTableSkeleton() {
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
