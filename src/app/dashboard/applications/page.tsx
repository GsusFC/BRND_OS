import prisma from "@/lib/prisma"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ApplicationsPage() {
    // Fetch pending applications (banned = 1)
    const applications = await prisma.brand.findMany({
        where: { banned: 1 },
        include: { category: true },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Brand Applications
                </h1>
                <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-400 font-mono text-sm">
                        {applications.length} pending
                    </span>
                </div>
            </div>

            <p className="mt-2 text-zinc-500 font-mono text-sm">
                Review and approve new brand submissions from the /apply form
            </p>

            <div className="mt-8">
                <Suspense fallback={<ApplicationsSkeleton />}>
                    <ApplicationsTable applications={applications} />
                </Suspense>
            </div>
        </div>
    )
}

function ApplicationsSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 animate-pulse">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-zinc-800 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-5 w-48 bg-zinc-800 rounded" />
                            <div className="h-3 w-32 bg-zinc-800 rounded" />
                            <div className="h-3 w-64 bg-zinc-800 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
