"use client"

import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

interface SortableHeaderProps {
    column: string
    label: string
    className?: string
}

export function SortableHeader({ column, label, className = "" }: SortableHeaderProps) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    
    const currentSort = searchParams.get("sort") || "score"
    const currentOrder = searchParams.get("order") || "desc"
    const isActive = currentSort === column

    const handleSort = () => {
        const params = new URLSearchParams(searchParams)
        
        if (isActive) {
            // Toggle order si ya está activo
            params.set("order", currentOrder === "asc" ? "desc" : "asc")
        } else {
            // Nuevo sort, default desc para score, asc para name
            params.set("sort", column)
            params.set("order", column === "name" ? "asc" : "desc")
        }
        
        replace(`${pathname}?${params.toString()}`)
    }

    return (
        <button
            onClick={handleSort}
            className={`flex items-center gap-1 hover:text-white transition-colors ${className}`}
            aria-label={`Sort by ${label}`}
        >
            {label}
            {isActive ? (
                currentOrder === "asc" ? (
                    <ArrowUp className="w-3 h-3" />
                ) : (
                    <ArrowDown className="w-3 h-3" />
                )
            ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
            )}
        </button>
    )
}
