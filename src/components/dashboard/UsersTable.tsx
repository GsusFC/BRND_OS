import prisma from "@/lib/prisma"
import toplistsSnapshot from "@/../public/data/s1/toplists.json"
import { User as UserIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface User {
    id: number
    username: string
    photoUrl: string | null
    fid: number
    points: number
    role: string
    createdAt: Date
}

type SortField = "username" | "points" | "createdAt"
type SortOrder = "asc" | "desc"

export async function UsersTable({
    query,
    currentPage,
    role,
    sort = "points",
    order = "desc",
}: {
    query: string
    currentPage: number
    role?: string
    sort?: SortField
    order?: SortOrder
}) {
    const MYSQL_DISABLED = process.env.MYSQL_DISABLED === "true"
    const ITEMS_PER_PAGE = 10
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    // Construir filtro dinámico (MySQL con collation utf8mb4_general_ci es case-insensitive por defecto)
    const whereClause: {
        username?: { contains: string }
        role?: string
    } = {}

    if (query) {
        whereClause.username = { contains: query }
    }

    if (role && role !== "all") {
        whereClause.role = role
    }

    // Construir ordenación dinámica
    const orderBy = { [sort]: order }

    let users: User[] = []
    let totalCount = 0
    let dbError = false

    try {
        if (MYSQL_DISABLED) {
            const snapshot = toplistsSnapshot as { topUsersAllTime?: Array<{ fid: number | null; username: string; photoUrl: string | null; points: number; totalVotes: number }> }
            const rows: User[] = (snapshot.topUsersAllTime ?? []).map((u, index) => ({
                id: index + 1,
                fid: u.fid ?? 0,
                username: u.username ?? `fid:${u.fid ?? 0}`,
                photoUrl: u.photoUrl ?? null,
                points: u.points ?? 0,
                role: "user",
                createdAt: new Date(0),
            }))

            const filtered = rows.filter((user) => {
                if (query && !user.username.toLowerCase().includes(query.toLowerCase())) return false
                if (role && role !== "all" && user.role !== role) return false
                return true
            })

            totalCount = filtered.length
            const sorted = [...filtered].sort((a, b) => {
                const aValue = sort === "points" ? a.points : sort === "createdAt" ? a.createdAt.getTime() : a.username.toLowerCase()
                const bValue = sort === "points" ? b.points : sort === "createdAt" ? b.createdAt.getTime() : b.username.toLowerCase()
                if (aValue < bValue) return order === "asc" ? -1 : 1
                if (aValue > bValue) return order === "asc" ? 1 : -1
                return 0
            })

            users = sorted.slice(offset, offset + ITEMS_PER_PAGE)
        } else {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout')), 8000)
        )
        
        const dataPromise = Promise.all([
            prisma.user.count({ where: whereClause }),
            prisma.user.findMany({
                where: whereClause,
                orderBy,
                skip: offset,
                take: ITEMS_PER_PAGE,
            })
        ])

        const [count, data] = await Promise.race([dataPromise, timeoutPromise]) as [number, User[]]
        totalCount = count
        users = data
        }
    } catch (error) {
        console.error("❌ UsersTable error:", error instanceof Error ? error.message : error)
        dbError = true
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    if (dbError) {
        return (
            <div className="mt-6 p-8 text-center rounded-xl border border-red-900/50 bg-red-950/20">
                <p className="text-red-400 font-mono text-sm">
                    ⚠️ Could not load users. Database connection timeout.
                </p>
                <p className="text-zinc-500 font-mono text-xs mt-2">
                    Please refresh the page or try again later.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-6 space-y-4">
            {/* Contador de resultados */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500 font-mono">
                    {totalCount === 0 ? (
                        "No users found"
                    ) : (
                        <>
                            Showing <span className="text-white font-medium">{offset + 1}</span> to{" "}
                            <span className="text-white font-medium">{Math.min(offset + ITEMS_PER_PAGE, totalCount)}</span>{" "}
                            of <span className="text-white font-medium">{totalCount.toLocaleString()}</span> users
                        </>
                    )}
                </p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[260px]">
                            <SortableHeader column="username" label="User" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader column="points" label="Points" />
                        </TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>
                            <SortableHeader column="createdAt" label="Joined" />
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user: User) => (
                        <TableRow key={user.id} className="hover:bg-[#212020]/50 transition-colors">
                            <TableCell>
                                <Link href={`/dashboard/users/${user.id}`} className="flex items-center gap-3">
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
                                {user.points.toLocaleString()}
                            </TableCell>
                            <TableCell>
                                {user.role === 'admin' ? (
                                    <Badge variant="info">Admin</Badge>
                                ) : (
                                    <Badge variant="outline" className="font-mono uppercase text-[11px]">User</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-500 font-mono">
                                {new Date(user.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button asChild size="icon-sm" variant="ghost" title="View User">
                                        <Link href={`/dashboard/users/${user.id}`}>
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
