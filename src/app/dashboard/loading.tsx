export default function DashboardLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div>
                <div className="h-10 w-64 bg-zinc-800 rounded-lg" />
                <div className="h-4 w-96 bg-zinc-900 rounded mt-2" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-2xl bg-zinc-900 p-5 h-24" />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-zinc-900 h-[720px]" />
                <div className="rounded-xl bg-zinc-900 h-[720px]" />
            </div>

            {/* Analytics Section */}
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-xl bg-zinc-900 h-24" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-zinc-900 h-80" />
                    <div className="rounded-xl bg-zinc-900 h-80" />
                </div>
            </div>
        </div>
    )
}
