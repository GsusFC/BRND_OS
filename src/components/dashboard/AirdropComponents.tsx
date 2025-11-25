import { Coins, Users, Zap, Clock } from "lucide-react"

export async function AirdropStats() {
    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
            <div className="card-gradient rounded-2xl p-6 flex flex-col gap-4 group cursor-default">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-400 font-mono uppercase tracking-wider">Total Allocation</p>
                    <Coins className="h-5 w-5 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-2xl font-bold text-zinc-600 font-mono tracking-tight">Coming Soon</p>
            </div>

            <div className="card-gradient rounded-2xl p-6 flex flex-col gap-4 group cursor-default">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-400 font-mono uppercase tracking-wider">Qualified Users</p>
                    <Users className="h-5 w-5 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-2xl font-bold text-zinc-600 font-mono tracking-tight">—</p>
            </div>

            <div className="card-gradient rounded-2xl p-6 flex flex-col gap-4 group cursor-default">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-400 font-mono uppercase tracking-wider">Avg Score</p>
                    <Zap className="h-5 w-5 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-2xl font-bold text-zinc-600 font-mono tracking-tight">—</p>
            </div>
        </div>
    )
}

export async function AirdropTable({
    query: _query,
    currentPage: _currentPage,
}: {
    query: string
    currentPage: number
}) {
    // Variables prefijadas con _ para indicar que serán usadas en futura implementación
    void _query
    void _currentPage
    return (
        <div className="mt-6 p-16 text-center border border-dashed border-zinc-800 rounded-xl">
            <Clock className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 font-mono text-sm font-bold uppercase tracking-wider">Airdrop Module Coming Soon</p>
            <p className="text-zinc-600 font-mono text-xs mt-2">The airdrop scoring system is not yet configured in the database.</p>
        </div>
    )
}
