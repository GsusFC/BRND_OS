import turso from "@/lib/turso"
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ApplicationsPage() {
    // Fetch pending applications (banned = 1)
    const result = await turso.execute(`
        SELECT
            b.id,
            b.name,
            b.description,
            b.url,
            b.warpcastUrl,
            b.imageUrl,
            b.walletAddress,
            b.ownerFid,
            b.ownerPrimaryWallet,
            b.channel,
            b.profile,
            b.queryType,
            b.followerCount,
            b.categoryId AS brandCategoryId,
            b.createdAt,
            c.id AS categoryId,
            c.name AS categoryName
        FROM brands b
        LEFT JOIN categories c ON c.id = b.categoryId
        WHERE b.banned = 1
        ORDER BY b.createdAt DESC
    `)

    const applications = result.rows.map((row) => {
        const createdAtRaw = row.createdAt
        const createdAt = new Date(String(createdAtRaw))
        if (!Number.isFinite(createdAt.getTime())) {
            throw new Error(`Invalid createdAt value for application ${String(row.id)}`)
        }

        const categoryIdRaw = row.categoryId
        const categoryNameRaw = row.categoryName
        const category =
            categoryIdRaw !== null && categoryIdRaw !== undefined && categoryNameRaw !== null && categoryNameRaw !== undefined
                ? { id: Number(categoryIdRaw), name: String(categoryNameRaw) }
                : null

        return {
            id: Number(row.id),
            name: String(row.name),
            description: row.description === null || row.description === undefined ? null : String(row.description),
            url: row.url === null || row.url === undefined ? null : String(row.url),
            warpcastUrl: row.warpcastUrl === null || row.warpcastUrl === undefined ? null : String(row.warpcastUrl),
            imageUrl: row.imageUrl === null || row.imageUrl === undefined ? null : String(row.imageUrl),
            walletAddress: row.walletAddress === null || row.walletAddress === undefined ? null : String(row.walletAddress),
            ownerFid: row.ownerFid === null || row.ownerFid === undefined ? null : Number(row.ownerFid),
            ownerPrimaryWallet: row.ownerPrimaryWallet === null || row.ownerPrimaryWallet === undefined ? null : String(row.ownerPrimaryWallet),
            channel: row.channel === null || row.channel === undefined ? null : String(row.channel),
            profile: row.profile === null || row.profile === undefined ? null : String(row.profile),
            queryType: row.queryType === null || row.queryType === undefined ? null : Number(row.queryType),
            followerCount: row.followerCount === null || row.followerCount === undefined ? null : Number(row.followerCount),
            categoryId: row.brandCategoryId === null || row.brandCategoryId === undefined ? null : Number(row.brandCategoryId),
            createdAt,
            category,
        }
    })

    const categoriesResult = await turso.execute("SELECT id, name FROM categories ORDER BY name ASC")
    const categories = categoriesResult.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
    }))

    return (
        <div className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Pending Onchain
                </h1>
                <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-400 font-mono text-sm">
                        {applications.length} pending
                    </span>
                </div>
            </div>

            <p className="mt-2 text-zinc-500 font-mono text-sm">
                Review and approve new brand submissions to move them onchain for Season 2
            </p>

            <div className="mt-8">
                <Suspense fallback={<ApplicationsSkeleton />}>
                    <ApplicationsTable applications={applications} categories={categories} />
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
