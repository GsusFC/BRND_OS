"use client"

import Link from "next/link"
import { Home, ArrowLeft } from "lucide-react"

export default function DashboardNotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 bg-zinc-900/50 rounded-3xl flex items-center justify-center mb-8 border border-zinc-800">
                <span className="text-4xl">🔍</span>
            </div>
            
            <h1 className="text-4xl font-black text-white font-display uppercase mb-4">
                Page Not Found
            </h1>
            
            <p className="text-zinc-500 font-mono text-sm mb-8 max-w-md">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            
            <div className="flex gap-4">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                >
                    <Home className="w-4 h-4" />
                    Dashboard
                </Link>
                <button
                    onClick={() => history.back()}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
            </div>
        </div>
    )
}
