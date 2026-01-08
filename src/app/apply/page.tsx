import turso from "@/lib/turso"
import { TokenGatedApplyForm } from "@/components/brands/TokenGatedApplyForm"
import { CANONICAL_CATEGORY_NAMES, getMissingCanonicalCategories, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"
import ConnectButton from "@/components/web3/ConnectButton"
import { Header } from "@/components/landing/Header"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ApplyPage() {
    const canonicalNames = Array.from(CANONICAL_CATEGORY_NAMES)
    const placeholders = canonicalNames.map(() => "?").join(", ")
    const result = await turso.execute({
        sql: `SELECT id, name FROM categories WHERE name IN (${placeholders})`,
        args: canonicalNames,
    })
    const categoriesRaw = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
    }))
    const missing = getMissingCanonicalCategories(categoriesRaw)
    if (missing.length > 0) {
        return (
            <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
                <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-8">
                        <h1 className="text-xl font-bold text-red-400 font-mono">Missing categories</h1>
                        <p className="mt-2 text-sm text-zinc-400 font-mono">
                            The following canonical categories are missing in the database:
                        </p>
                        <p className="mt-4 text-sm text-white font-mono">
                            {missing.join(", ")}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const categories = sortCategoriesByCanonicalOrder(categoriesRaw)

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
            <Header rightSlot={<ConnectButton variant="minimal" />} showActionsOnMobile />

            <div className="container mx-auto max-w-3xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-display uppercase mb-4">
                        Apply for Listing
                    </h2>
                    <p className="text-lg text-zinc-400 font-mono max-w-2xl mx-auto">
                        Submit your brand details for review.
                    </p>
                </div>

                <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden min-h-[400px]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFF100] via-[#FF0000] to-[#0C00FF]" />
                    <TokenGatedApplyForm categories={categories} />
                </div>

                <div className="mt-12 text-center">
                    <p className="text-sm text-zinc-600 font-mono">
                        &copy; {new Date().getFullYear()} BRND. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
