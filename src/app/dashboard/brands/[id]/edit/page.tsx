import turso from "@/lib/turso"
import { BrandForm } from "@/components/brands/BrandForm"
import { notFound } from "next/navigation"
import { CANONICAL_CATEGORY_NAMES, getMissingCanonicalCategories, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

export const dynamic = 'force-dynamic'

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const brandId = Number(id)
    if (!Number.isFinite(brandId) || brandId <= 0) {
        notFound()
    }

    const brandResult = await turso.execute({
        sql: `SELECT
            id,
            name,
            description,
            imageUrl,
            url,
            warpcastUrl,
            followerCount,
            channel,
            profile,
            walletAddress,
            queryType,
            categoryId
        FROM brands
        WHERE id = ?
        LIMIT 1`,
        args: [brandId],
    })
    const brandRow = brandResult.rows[0]
    if (!brandRow) {
        notFound()
    }

    const brand = {
        id: Number(brandRow.id),
        name: String(brandRow.name),
        description: brandRow.description === null || brandRow.description === undefined ? undefined : String(brandRow.description),
        imageUrl: brandRow.imageUrl === null || brandRow.imageUrl === undefined ? null : String(brandRow.imageUrl),
        url: brandRow.url === null || brandRow.url === undefined ? undefined : String(brandRow.url),
        warpcastUrl: brandRow.warpcastUrl === null || brandRow.warpcastUrl === undefined ? undefined : String(brandRow.warpcastUrl),
        followerCount: brandRow.followerCount === null || brandRow.followerCount === undefined ? undefined : Number(brandRow.followerCount),
        channel: brandRow.channel === null || brandRow.channel === undefined ? null : String(brandRow.channel),
        profile: brandRow.profile === null || brandRow.profile === undefined ? null : String(brandRow.profile),
        walletAddress: brandRow.walletAddress === null || brandRow.walletAddress === undefined ? null : String(brandRow.walletAddress),
        queryType: brandRow.queryType === null || brandRow.queryType === undefined ? undefined : Number(brandRow.queryType),
        categoryId: brandRow.categoryId === null || brandRow.categoryId === undefined ? null : Number(brandRow.categoryId),
    }

    if (!brand) {
        notFound()
    }

    const canonicalNames = Array.from(CANONICAL_CATEGORY_NAMES)
    const placeholders = canonicalNames.map(() => "?").join(", ")
    const categoriesResult = await turso.execute({
        sql: `SELECT id, name FROM categories WHERE name IN (${placeholders})`,
        args: canonicalNames,
    })
    const categoriesRaw = categoriesResult.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
    }))

    const missing = getMissingCanonicalCategories(categoriesRaw)
    if (missing.length > 0) {
        return (
            <div className="w-full p-8 text-center rounded-xl border border-red-900/50 bg-red-950/20">
                <p className="text-red-400 font-mono text-sm">
                    Missing canonical categories in database:
                </p>
                <p className="mt-2 text-sm text-white font-mono">
                    {missing.join(", ")}
                </p>
            </div>
        )
    }

    const categories = sortCategoriesByCanonicalOrder(categoriesRaw)

    return (
        <div className="w-full">
            <BrandForm categories={categories} brand={brand} />
        </div>
    )
}
