export default function BrandDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Back button */}
            <div className="h-6 w-24 bg-zinc-900 rounded" />

            {/* Brand Header */}
            <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-[22%] bg-zinc-800" />
                <div className="flex-1 space-y-3">
                    <div className="h-8 w-48 bg-zinc-800 rounded-lg" />
                    <div className="h-4 w-64 bg-zinc-900 rounded" />
                    <div className="flex gap-2">
                        <div className="h-6 w-24 bg-zinc-900 rounded-full" />
                        <div className="h-6 w-24 bg-zinc-900 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl bg-zinc-900 h-24" />
                ))}
            </div>

            {/* Top Voters */}
            <div className="space-y-4">
                <div className="h-6 w-32 bg-zinc-800 rounded" />
                <div className="rounded-xl bg-zinc-900 h-64" />
            </div>
        </div>
    )
}
