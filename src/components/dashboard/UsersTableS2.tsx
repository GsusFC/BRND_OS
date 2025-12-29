import { User as UserIcon, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getIndexerUsers } from "@/lib/seasons"
import { formatCompactNumber } from "@/lib/utils"

type SortField = "points" | "totalVotes" | "powerLevel" | "fid"
type SortOrder = "asc" | "desc"

export async function UsersTableS2({
    query,
    currentPage,
    sort = "points",
    order = "desc",
}: {
    query: string
    currentPage: number
    sort?: SortField
    order?: SortOrder
}) {
    const ITEMS_PER_PAGE = 10

    let users: Awaited<ReturnType<typeof getIndexerUsers>>["users"] = []
    let totalCount = 0
    let dbError = false
    let dbErrorMessage: string | null = null

    try {
        const result = await getIndexerUsers({
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            sortBy: sort,
            sortOrder: order,
            query: query || undefined,
        })
        users = result.users
        totalCount = result.totalCount
    } catch (error) {
        dbErrorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error("❌ UsersTableS2 error:", dbErrorMessage)
        dbError = true
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    if (dbError) {
        return (
            <div className="mt-6 p-8 text-center rounded-xl border border-red-900/50 bg-red-950/20">
                <p className="text-red-400 font-mono text-sm">
                    ⚠️ Could not load users. Indexer connection error.
                </p>
                <p className="text-zinc-500 font-mono text-xs mt-2">
                    Please refresh the page or try again later.
                </p>
                {dbErrorMessage && (
                    <p className="text-zinc-400 font-mono text-xs mt-3 break-words">
                        {dbErrorMessage}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500 font-mono">
                    {totalCount === 0 ? (
                        "No users found"
                    ) : (
                        <>
                            Showing <span className="text-white font-medium">{offset + 1}</span> to{" "}
                            <span className="text-white font-medium">{Math.min(offset + ITEMS_PER_PAGE, totalCount)}</span>{" "}
                            of <span className="text-white font-medium">{totalCount.toLocaleString()}</span> onchain users
                        </>
                    )}
                </p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[260px]">
                            <SortableHeader column="fid" label="User" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="points" label="Points" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="powerLevel" label="Power Level" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="totalVotes" label="Total Votes" />
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.fid} className="hover:bg-[#212020]/50 transition-colors">
                            <TableCell>
                                <Link href={`/dashboard/users/${user.fid}`} className="flex items-center gap-3">
                                    {user.photoUrl ? (
                                        <Image
                                            src={user.photoUrl}
                                            className="w-8 h-8 rounded-full object-cover ring-1 ring-border group-hover:ring-white/50 transition-all"
                                            width={32}
                                            height={32}
                                            alt={`${user.username}'s profile picture`}
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-border group-hover:ring-white/50 transition-all">
                                            <UserIcon className="h-4 w-4 text-zinc-500" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <p className="font-bold text-zinc-300 font-display tracking-wide uppercase group-hover:text-white transition-colors">
                                            {user.username}
                                        </p>
                                        <span className="text-[10px] text-zinc-600 font-mono">
                                            FID: {user.fid}
                                        </span>
                                    </div>
                                </Link>
                            </TableCell>
                            <TableCell className="font-display text-lg font-bold text-zinc-400 uppercase">
                                {formatCompactNumber(user.points)}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-yellow-500" />
                                    <span className="font-display font-bold text-yellow-500">
                                        {user.powerLevel}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-mono">
                                    {user.totalVotes}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button asChild size="icon-sm" variant="ghost" title="View User">
                                        <Link href={`/dashboard/users/${user.fid}`}>
                                            <UserIcon className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {users.length === 0 && (
                <div className="p-12 text-center border border-[#484E55] rounded-lg">
                    <p className="text-zinc-500 font-mono text-sm">No users found.</p>
                </div>
            )}

            <Pagination totalPages={totalPages} />
        </div>
    )
}
