import prisma from "@/lib/prisma"
import prismaWrite from "@/lib/prisma-write"
import { Trophy, Edit, CheckCircle, XCircle } from "lucide-react"
import Image from "next/image"
import { toggleBrandStatus } from "@/lib/actions/brand-actions"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"

interface Category {
    id: number
    name: string
}

interface Brand {
    id: number
    name: string
    imageUrl: string | null
    score: number | null
    banned: number
    category: Category | null
}

export async function BrandsTable({
    query,
    currentPage,
    status = "active",
}: {
    query: string
    currentPage: number
    status?: string
}) {
    const ITEMS_PER_PAGE = 10
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    // Construir el filtro dinámico (MySQL no soporta mode: 'insensitive')
    const whereClause: { 
        name?: { contains: string } 
        banned?: number 
    } = {}

    if (query) {
        whereClause.name = { contains: query }
    }

    if (status === "active") {
        whereClause.banned = 0
    } else if (status === "pending") {
        whereClause.banned = 1
    }
    // Si es "all", no añadimos filtro de banned

    // Fetch from both databases, but handle read DB errors gracefully
    let readBrands: Brand[] = [];
    let writeBrands: Brand[] = [];

    try {
        readBrands = await prisma.brand.findMany({
            where: whereClause,
            include: {
                category: true,
            },
            orderBy: { score: "desc" },
        });
    } catch (error) {
        console.warn("⚠️ Could not fetch from read DB (connection issue):", error instanceof Error ? error.message : error);
        // Continue with empty array for read brands
    }

    try {
        writeBrands = await prismaWrite.brand.findMany({
            where: whereClause,
            include: {
                category: true,
            },
            orderBy: { createdAt: "desc" },
        });
    } catch (error) {
        console.error("❌ Error fetching from write DB:", error);
        // This is more critical since it's our local DB
    }

    // Merge and Sort
    // Note: IDs might conflict if both start at 1. 
    // We might need a way to distinguish them. For now, let's just merge.
    // Ideally, write DB IDs should be distinct or we add a flag.
    const allBrands = [...writeBrands, ...readBrands]
    const totalCount = allBrands.length
    const brands = allBrands.slice(offset, offset + ITEMS_PER_PAGE)

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    return (
        <div className="mt-6 flow-root">
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full">
                        <thead className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                            <tr>
                                <th scope="col" className="px-4 py-4 font-bold sm:pl-6">
                                    Brand
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Category
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Score
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Status
                                </th>
                                <th scope="col" className="relative py-3 pl-6 pr-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {brands.map((brand: Brand) => (
                                <tr
                                    key={brand.id}
                                    className="hover:bg-zinc-950/50 transition-colors group"
                                >
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/dashboard/brands/${brand.id}`} className="group flex items-center gap-3">
                                                {brand.imageUrl ? (
                                                    <Image
                                                        src={brand.imageUrl}
                                                        className="rounded-lg object-cover ring-1 ring-border group-hover:ring-white/50 transition-all"
                                                        width={32}
                                                        height={32}
                                                        alt={`${brand.name} logo`}
                                                    />
                                                ) : (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-border group-hover:ring-white/50 transition-all">
                                                        <Trophy className="h-4 w-4 text-zinc-500" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <p className="font-bold text-zinc-300 font-display tracking-wide group-hover:text-white transition-colors">
                                                        {brand.name}
                                                    </p>
                                                    <span className="text-[10px] text-zinc-600 font-mono">
                                                        ID: {brand.id}
                                                    </span>
                                                </div>
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4">
                                        <span className="inline-flex items-center rounded-md bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-500 font-mono uppercase">
                                            {brand.category?.name ?? 'Uncategorized'}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 font-display text-lg font-bold text-zinc-400">
                                        {brand.score?.toLocaleString() ?? 0}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4">
                                        {brand.banned === 1 ? (
                                            <span className="inline-flex items-center rounded-full bg-yellow-950/20 px-2 py-1 text-xs font-medium text-yellow-600 font-mono">
                                                PENDING
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-green-950/20 px-2 py-1 text-xs font-medium text-green-600 font-mono">
                                                ACTIVE
                                            </span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/dashboard/brands/${brand.id}/edit`}
                                                className="rounded-lg border border-transparent p-2 hover:bg-white/10 hover:text-white text-zinc-500 transition-all"
                                                title="Edit Brand"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Link>

                                            <form action={toggleBrandStatus.bind(null, brand.id, brand.banned)}>
                                                <button
                                                    type="submit"
                                                    className={`rounded-lg border border-transparent p-2 transition-all ${brand.banned === 1
                                                        ? "text-green-500 hover:bg-green-950/30 hover:text-green-400"
                                                        : "text-red-500 hover:bg-red-950/30 hover:text-red-400"
                                                        }`}
                                                    title={brand.banned === 1 ? "Approve Brand" : "Ban Brand"}
                                                >
                                                    {brand.banned === 1 ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>


                    {brands.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-zinc-500 font-mono text-sm">No brands found in this category.</p>
                        </div>
                    )}
                </div>
            </div>

            <Pagination totalPages={totalPages} />
        </div>
    )
}
