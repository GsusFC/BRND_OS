import prisma from "@/lib/prisma"
import { Trophy, Edit } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { ToggleStatusButton } from "./ToggleStatusButton"
import { SortableHeader } from "@/components/ui/SortableHeader"

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

type SortField = "name" | "score"
type SortOrder = "asc" | "desc"

export async function BrandsTable({
    query,
    currentPage,
    status = "active",
    categoryId,
    sort = "score",
    order = "desc",
}: {
    query: string
    currentPage: number
    status?: string
    categoryId?: number
    sort?: SortField
    order?: SortOrder
}) {
    const ITEMS_PER_PAGE = 10
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    // Construir el filtro dinámico (MySQL con collation utf8mb4_general_ci es case-insensitive por defecto)
    const whereClause: { 
        name?: { contains: string } 
        banned?: number
        categoryId?: number
    } = {}

    if (query) {
        whereClause.name = { contains: query }
    }

    if (status === "active") {
        whereClause.banned = 0
    } else if (status === "pending") {
        whereClause.banned = 1
    }

    if (categoryId) {
        whereClause.categoryId = categoryId
    }

    // Construir ordenación dinámica
    const orderBy = { [sort]: order }

    // Fetch from read DB with pagination (main source)
    let brands: Brand[] = [];
    let totalCount = 0;
    let dbError = false;

    try {
        // Get count and paginated data in parallel with timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout')), 8000)
        );
        
        const dataPromise = Promise.all([
            prisma.brand.count({ where: whereClause }),
            prisma.brand.findMany({
                where: whereClause,
                include: { category: true },
                orderBy,
                skip: offset,
                take: ITEMS_PER_PAGE,
            })
        ]);

        const [count, data] = await Promise.race([dataPromise, timeoutPromise]) as [number, Brand[]];
        totalCount = count;
        brands = data;
    } catch (error) {
        console.error("❌ BrandsTable error:", error instanceof Error ? error.message : error);
        dbError = true;
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
    
    if (dbError) {
        return (
            <div className="mt-6 p-8 text-center rounded-xl border border-red-900/50 bg-red-950/20">
                <p className="text-red-400 font-mono text-sm">
                    ⚠️ Could not load brands. Database connection timeout.
                </p>
                <p className="text-zinc-500 font-mono text-xs mt-2">
                    Please refresh the page or try again later.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-6 flow-root">
            {/* Contador de resultados */}
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-zinc-500 font-mono">
                    {totalCount === 0 ? (
                        "No brands found"
                    ) : (
                        <>
                            Showing <span className="text-white font-medium">{offset + 1}</span> to{" "}
                            <span className="text-white font-medium">{Math.min(offset + ITEMS_PER_PAGE, totalCount)}</span>{" "}
                            of <span className="text-white font-medium">{totalCount.toLocaleString()}</span> brands
                        </>
                    )}
                </p>
            </div>

            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full">
                        <thead className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                            <tr>
                                <th scope="col" className="px-4 py-4 font-bold sm:pl-6">
                                    <SortableHeader column="name" label="Brand" />
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Category
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    <SortableHeader column="score" label="Score" />
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
                                                    <p className="font-bold text-zinc-300 font-display tracking-wide uppercase group-hover:text-white transition-colors">
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
                                    <td className="whitespace-nowrap px-3 py-4 font-display text-lg font-bold text-zinc-400 uppercase">
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

                                            <ToggleStatusButton
                                                brandId={brand.id}
                                                brandName={brand.name}
                                                currentStatus={brand.banned}
                                            />
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
