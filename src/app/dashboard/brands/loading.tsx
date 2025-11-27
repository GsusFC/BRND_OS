export default function BrandsLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-10 w-32 bg-zinc-800 rounded-lg" />
                    <div className="h-4 w-48 bg-zinc-900 rounded mt-2" />
                </div>
                <div className="h-10 w-32 bg-zinc-900 rounded-lg" />
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="h-10 w-64 bg-zinc-900 rounded-lg" />
                <div className="h-10 w-40 bg-zinc-900 rounded-lg" />
            </div>

            {/* Table */}
            <div className="rounded-xl bg-zinc-900 overflow-hidden">
                <div className="h-12 bg-zinc-800" />
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 border-t border-zinc-800" />
                ))}
            </div>
        </div>
    )
}
