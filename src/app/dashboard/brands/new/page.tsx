import prisma from "@/lib/prisma"
import { BrandForm } from "@/components/brands/BrandForm"

export default async function NewBrandPage() {
    let categories: { id: number; name: string }[] = []
    
    try {
        categories = await prisma.category.findMany({
            select: { id: true, name: true }
        })
    } catch (error) {
        console.error("❌ Failed to load categories:", error)
    }

    if (categories.length === 0) {
        return (
            <div className="w-full p-8 text-center rounded-xl border border-yellow-900/50 bg-yellow-950/20">
                <p className="text-yellow-400 font-mono text-sm">
                    ⚠️ Could not load categories. Database connection issue.
                </p>
            </div>
        )
    }

    return (
        <div className="w-full">
            <BrandForm categories={categories} />
        </div>
    )
}
