import prisma from "@/lib/prisma"
import { BrandForm } from "@/components/brands/BrandForm"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const brand = await prisma.brand.findUnique({
        where: { id: Number(id) },
    })

    if (!brand) {
        notFound()
    }

    const categories = await prisma.category.findMany()

    return (
        <div className="w-full">
            <BrandForm categories={categories} brand={brand} />
        </div>
    )
}
