import prisma from "@/lib/prisma"
import { Trophy, Edit } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { ToggleStatusButton } from "./ToggleStatusButton"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
        <div className="mt-6 space-y-4">
            {/* Contador de resultados */}
            <div className="flex items-center justify-between">
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

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[260px]">
                            <SortableHeader column="name" label="Brand" />
                        </TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>
                            <SortableHeader column="score" label="Score" />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {brands.map((brand: Brand) => (
                        <TableRow key={brand.id} className="hover:bg-[#212020]/50 transition-colors">
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="uppercase font-mono text-[11px]">
                                    {brand.category?.name ?? 'Uncategorized'}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-display text-lg font-bold text-zinc-400 uppercase">
                                {brand.score?.toLocaleString() ?? 0}
                            </TableCell>
                            <TableCell>
                                {brand.banned === 1 ? (
                                    <Badge variant="warning">Pending</Badge>
                                ) : (
                                    <Badge variant="success">Active</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button asChild size="icon-sm" variant="ghost" title="Edit Brand">
                                        <Link href={`/dashboard/brands/${brand.id}/edit`}>
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                    <ToggleStatusButton
                                        brandId={brand.id}
                                        brandName={brand.name}
                                        currentStatus={brand.banned}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {brands.length === 0 && (
                <div className="p-12 text-center border border-[#484E55] rounded-lg">
                    <p className="text-zinc-500 font-mono text-sm">No brands found in this category.</p>
                </div>
            )}

            <Pagination totalPages={totalPages} />
        </div>
    )
}
