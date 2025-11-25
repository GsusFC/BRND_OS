"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

export function AddBrandFAB() {
    return (
        <Link
            href="/dashboard/brands/new"
            className="fixed bottom-8 right-8 z-50 flex items-center gap-2 px-6 py-4 rounded-full bg-white text-black font-display font-black text-sm uppercase tracking-wide shadow-2xl hover:scale-105 transition-transform duration-200 group"
        >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Add Brand
        </Link>
    )
}
