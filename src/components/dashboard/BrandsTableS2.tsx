import { Trophy } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getIndexerBrands } from "@/lib/seasons"

type SortField = "allTimePoints" | "goldCount" | "id"
type SortOrder = "asc" | "desc"

export async function BrandsTableS2({
    query,
    currentPage,
    sort = "allTimePoints",
    order = "desc",
}: {
    query: string
    currentPage: number
    sort?: SortField
    order?: SortOrder
}) {
    const ITEMS_PER_PAGE = 10

    let brands: Awaited<ReturnType<typeof getIndexerBrands>>["brands"] = []
    let totalCount = 0
    let dbError = false

    try {
        const result = await getIndexerBrands({
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            sortBy: sort,
            sortOrder: order,
            query: query || undefined,
        })
        brands = result.brands
        totalCount = result.totalCount
    } catch (error) {
        console.error("❌ BrandsTableS2 error:", error instanceof Error ? error.message : error)
        dbError = true
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    if (dbError) {
        return (
            <div className="mt-6 p-8 text-center rounded-xl border border-red-900/50 bg-red-950/20">
                <p className="text-red-400 font-mono text-sm">
                    ⚠️ Could not load brands. Indexer connection error.
                </p>
                <p className="text-zinc-500 font-mono text-xs mt-2">
                    Please refresh the page or try again later.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500 font-mono">
                    {totalCount === 0 ? (
                        "No brands found"
                    ) : (
                        <>
                            Showing <span className="text-white font-medium">{offset + 1}</span> to{" "}
                            <span className="text-white font-medium">{Math.min(offset + ITEMS_PER_PAGE, totalCount)}</span>{" "}
                            of <span className="text-white font-medium">{totalCount.toLocaleString()}</span> onchain brands
                        </>
                    )}
                </p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Rank</TableHead>
                        <TableHead className="w-[260px]">
                            <SortableHeader column="id" label="Brand" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="allTimePoints" label="All-Time Points" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="goldCount" label="Medals" />
                        </TableHead>
                        <TableHead>Weekly</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {brands.map((brand) => (
                        <TableRow key={brand.id} className="hover:bg-[#212020]/50 transition-colors">
                            <TableCell>
                                <span className="text-lg font-black text-zinc-500 font-display">
                                    #{brand.allTimeRank ?? "-"}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Link href={`/dashboard/brands/${brand.id}`} className="flex items-center gap-3">
                                    {brand.imageUrl ? (
                                        <Image
                                            src={brand.imageUrl}
                                            className="w-8 h-8 rounded-lg object-cover ring-1 ring-border"
                                            width={32}
                                            height={32}
                                            alt={brand.name}
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-border">
                                            <Trophy className="h-4 w-4 text-zinc-500" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <p className="font-bold text-zinc-300 font-display tracking-wide uppercase group-hover:text-white transition-colors">
                                            {brand.name}
                                        </p>
                                        <span className="text-[10px] text-zinc-600 font-mono">
                                            ID: {brand.id} {brand.channel && `• /${brand.channel}`}
                                        </span>
                                    </div>
                                </Link>
                            </TableCell>
                            <TableCell className="font-display text-lg font-bold text-zinc-400 uppercase">
                                {brand.allTimePoints.toLocaleString()}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 text-sm">
                                    <span title="Gold">🥇 {brand.goldCount}</span>
                                    <span title="Silver">🥈 {brand.silverCount}</span>
                                    <span title="Bronze">🥉 {brand.bronzeCount}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {brand.weeklyRank ? (
                                    <Badge variant="outline" className="font-mono">
                                        #{brand.weeklyRank} • {brand.weeklyPoints.toLocaleString()} pts
                                    </Badge>
                                ) : (
                                    <span className="text-zinc-600 text-xs">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button asChild size="icon-sm" variant="ghost" title="View Brand">
                                        <Link href={`/dashboard/brands/${brand.id}`}>
                                            <Trophy className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {brands.length === 0 && (
                <div className="p-12 text-center border border-[#484E55] rounded-lg">
                    <p className="text-zinc-500 font-mono text-sm">No brands found.</p>
                </div>
            )}

            <Pagination totalPages={totalPages} />
        </div>
    )
}
