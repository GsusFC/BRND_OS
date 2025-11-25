"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function Pagination({ totalPages }: { totalPages: number }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentPage = Number(searchParams.get("page")) || 1

    const createPageURL = (pageNumber: number | string) => {
        const params = new URLSearchParams(searchParams)
        params.set("page", pageNumber.toString())
        return `${pathname}?${params.toString()}`
    }

    if (totalPages <= 1) return null

    return (
        <div className="flex items-center justify-center gap-2 mt-6">
            {/* Previous Button */}
            <Link
                href={createPageURL(currentPage - 1)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all font-mono text-sm ${currentPage <= 1
                        ? "border-zinc-800 text-zinc-600 cursor-not-allowed pointer-events-none"
                        : "border-border bg-surface text-white hover:bg-surface-hover hover:border-zinc-600"
                    }`}
                aria-disabled={currentPage <= 1}
            >
                <ChevronLeft className="w-4 h-4" />
                Previous
            </Link>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)

                    if (!showPage) {
                        // Show ellipsis
                        if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                                <span key={page} className="px-2 text-zinc-600">
                                    ...
                                </span>
                            )
                        }
                        return null
                    }

                    return (
                        <Link
                            key={page}
                            href={createPageURL(page)}
                            className={`px-3 py-2 rounded-lg border transition-all font-mono text-sm font-bold ${currentPage === page
                                    ? "border-white bg-white text-black"
                                    : "border-border bg-surface text-white hover:bg-surface-hover hover:border-zinc-600"
                                }`}
                        >
                            {page}
                        </Link>
                    )
                })}
            </div>

            {/* Next Button */}
            <Link
                href={createPageURL(currentPage + 1)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all font-mono text-sm ${currentPage >= totalPages
                        ? "border-zinc-800 text-zinc-600 cursor-not-allowed pointer-events-none"
                        : "border-border bg-surface text-white hover:bg-surface-hover hover:border-zinc-600"
                    }`}
                aria-disabled={currentPage >= totalPages}
            >
                Next
                <ChevronRight className="w-4 h-4" />
            </Link>
        </div>
    )
}
