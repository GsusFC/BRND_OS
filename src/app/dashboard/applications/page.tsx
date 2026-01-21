import turso from "@/lib/turso"
import { OnchainTabs } from "@/components/dashboard/OnchainTabs"
import { enforceAnyPermission } from "@/lib/auth-checks"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { ApplicationsHeader } from "@/components/dashboard/ApplicationsHeader"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const PAGE_SIZE = 20

export default async function ApplicationsPage(props: {
    searchParams?: Promise<{ page?: string }>
}) {
    await enforceAnyPermission([PERMISSIONS.APPLICATIONS])

    const resolvedSearchParams = await props.searchParams
    const pageRaw = resolvedSearchParams?.page
    const requestedPage = pageRaw ? Number(pageRaw) : 1
    const safeRequestedPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

    const countResult = await turso.execute("SELECT COUNT(*) AS count FROM brands WHERE banned = 1")
    const countValue = countResult.rows[0]?.count
    const totalCount = Number(countValue ?? 0)
    const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)
    const page = Math.min(safeRequestedPage, totalPages)
    const offset = (page - 1) * PAGE_SIZE

    // Fetch pending applications (banned = 1)
    const result = await turso.execute({
        sql: `
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
                b.ownerWalletFid,
                b.channel,
                b.profile,
                b.tokenContractAddress,
                b.tokenTicker,
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
            LIMIT ? OFFSET ?
        `,
        args: [PAGE_SIZE, offset],
    })

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
            ownerWalletFid: row.ownerWalletFid === null || row.ownerWalletFid === undefined ? null : Number(row.ownerWalletFid),
            channel: row.channel === null || row.channel === undefined ? null : String(row.channel),
            profile: row.profile === null || row.profile === undefined ? null : String(row.profile),
            tokenContractAddress: row.tokenContractAddress === null || row.tokenContractAddress === undefined ? null : String(row.tokenContractAddress),
            tokenTicker: row.tokenTicker === null || row.tokenTicker === undefined ? null : String(row.tokenTicker),
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
            <ApplicationsHeader totalCount={totalCount} />

            <OnchainTabs
                applications={applications}
                categories={categories}
                pendingTotalPages={totalPages}
            />
        </div>
    )
}
