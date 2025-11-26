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
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white font-mono">Edit Brand</h1>
                <p className="text-zinc-500 mt-1 font-mono text-sm">Update details for {brand.name}.</p>
            </div>
            <BrandForm categories={categories} brand={brand} />
        </div>
    )
}
