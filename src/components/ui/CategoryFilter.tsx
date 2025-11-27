"use client"

import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"

interface Category {
    id: number
    name: string
}

interface CategoryFilterProps {
    categories: Category[]
}

export function CategoryFilter({ categories }: CategoryFilterProps) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    const currentCategory = searchParams.get("category") || ""

    const handleCategoryChange = (categoryId: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("page", "1")
        if (categoryId) {
            params.set("category", categoryId)
        } else {
            params.delete("category")
        }
        replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="relative">
            <select
                value={currentCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="appearance-none rounded-lg border-[0.75px] border-[#484E55] bg-[#212020] py-[9px] pl-3 pr-10 text-sm text-white font-mono transition-colors focus:border-white focus:ring-1 focus:ring-white cursor-pointer"
                aria-label="Filter by category"
            >
                <option value="">All Categories</option>
                {categories.map((category) => (
                    <option key={category.id} value={category.id.toString()}>
                        {category.name}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
    )
}
