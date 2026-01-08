import turso from "@/lib/turso"
import { BrandForm } from "@/components/brands/BrandForm"
import { CANONICAL_CATEGORY_NAMES, getMissingCanonicalCategories, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

export const dynamic = 'force-dynamic'

export default async function NewBrandPage() {
    let categoriesRaw: { id: number; name: string }[] = []
    
    try {
        const canonicalNames = Array.from(CANONICAL_CATEGORY_NAMES)
        const placeholders = canonicalNames.map(() => "?").join(", ")
        const result = await turso.execute({
            sql: `SELECT id, name FROM categories WHERE name IN (${placeholders})`,
            args: canonicalNames,
        })
        categoriesRaw = result.rows.map((row) => ({
            id: Number(row.id),
            name: String(row.name),
        }))
    } catch (error) {
        console.error("❌ Failed to load categories:", error)
    }

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
            <BrandForm categories={categories} />
        </div>
    )
}
