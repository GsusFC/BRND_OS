import { Suspense } from "react"
import { getAllowedWallets } from "@/lib/actions/wallet-actions"
import { AllowlistTable } from "@/components/dashboard/AllowlistTable"
import { AddWalletForm } from "@/components/dashboard/AddWalletForm"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AllowlistPage() {
    const wallets = await getAllowedWallets()

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Wallet Allowlist
                </h1>
            </div>

            <p className="mt-2 text-zinc-500 font-mono text-sm">
                Manage wallets that can access the brand application form
            </p>

            {/* Add wallet form */}
            <div className="mt-8">
                <AddWalletForm />
            </div>

            {/* Wallets table */}
            <div className="mt-8">
                <Suspense fallback={<AllowlistTableSkeleton />}>
                    <AllowlistTable wallets={wallets} />
                </Suspense>
            </div>
        </div>
    )
}

function AllowlistTableSkeleton() {
    return (
        <div className="mt-6 flow-root">
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                    {/* Header skeleton */}
                    <div className="flex gap-4 py-4 px-6 bg-zinc-900/50 border-b border-zinc-800">
                        <div className="h-3 w-32 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-24 animate-pulse bg-zinc-800 rounded" />
                        <div className="h-3 w-20 animate-pulse bg-zinc-800 rounded" />
                    </div>

                    {/* Rows skeleton */}
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-4 px-6 border-b border-zinc-800">
                            <div className="h-4 w-80 animate-pulse bg-zinc-800 rounded font-mono" />
                            <div className="h-4 w-32 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-4 w-24 animate-pulse bg-zinc-800 rounded" />
                            <div className="h-8 w-8 animate-pulse bg-zinc-800 rounded ml-auto" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
