import prisma from "@/lib/prisma"
import { BrandForm } from "@/components/brands/BrandForm"

export default async function NewBrandPage() {
    const categories = await prisma.category.findMany()

    return (
        <div className="w-full">
            <BrandForm categories={categories} />
        </div>
    )
}
