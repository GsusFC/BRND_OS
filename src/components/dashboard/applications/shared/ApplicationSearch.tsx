"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ApplicationSearchProps<T extends { name: string; description?: string | null; channel?: string | null; profile?: string | null }> {
    applications: T[]
    onFilter: (filtered: T[]) => void
    className?: string
}

export function ApplicationSearch<T extends { name: string; description?: string | null; channel?: string | null; profile?: string | null }>({
    applications,
    onFilter,
    className,
}: ApplicationSearchProps<T>) {
    const [query, setQuery] = useState("")

    const handleSearch = (value: string) => {
        setQuery(value)
        if (!value.trim()) {
            onFilter(applications)
            return
        }

        const searchTerm = value.toLowerCase().trim()
        const filtered = applications.filter((app) => {
            const name = app.name?.toLowerCase() || ""
            const description = app.description?.toLowerCase() || ""
            const channel = app.channel?.toLowerCase() || ""
            const profile = app.profile?.toLowerCase() || ""
            return (
                name.includes(searchTerm) ||
                description.includes(searchTerm) ||
                channel.includes(searchTerm) ||
                profile.includes(searchTerm)
            )
        })
        onFilter(filtered)
    }

    const clearSearch = () => {
        setQuery("")
        onFilter(applications)
    }

    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search applications..."
                className="pl-10 pr-10"
            />
            {query && (
                <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

export function useApplicationSearch<T>(applications: T[]) {
    const [filtered, setFiltered] = useState<T[]>(applications)

    useMemo(() => {
        setFiltered(applications)
    }, [applications])

    return {
        filtered,
        setFiltered,
    }
}
