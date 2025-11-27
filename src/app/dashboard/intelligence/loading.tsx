export default function IntelligenceLoading() {
    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center animate-pulse">
            {/* Icon */}
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl mb-8" />
            
            {/* Title */}
            <div className="h-10 w-64 bg-zinc-800 rounded-lg mb-4" />
            <div className="h-4 w-96 bg-zinc-900 rounded mb-8" />
            
            {/* Query cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl bg-zinc-900 h-20" />
                ))}
            </div>
        </div>
    )
}
