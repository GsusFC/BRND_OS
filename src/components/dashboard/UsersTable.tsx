import prisma from "@/lib/prisma"
import { User as UserIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Pagination } from "@/components/ui/Pagination"
import { SortableHeader } from "@/components/ui/SortableHeader"

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
        <div className="mt-6 flow-root">
            {/* Contador de resultados */}
            <div className="mb-4 flex items-center justify-between">
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

            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full">
                        <thead className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                            <tr>
                                <th scope="col" className="px-4 py-4 font-bold sm:pl-6">
                                    <SortableHeader column="username" label="User" />
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    <SortableHeader column="points" label="Points" />
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Role
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    <SortableHeader column="createdAt" label="Joined" />
                                </th>
                                <th scope="col" className="relative py-3 pl-6 pr-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {users.map((user: User) => (
                                <tr
                                    key={user.id}
                                    className="hover:bg-zinc-950/50 transition-colors group"
                                >
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
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
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 font-display text-lg font-bold text-zinc-400 uppercase">
                                        {user.points.toLocaleString()}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4">
                                        {user.role === 'admin' ? (
                                            <span className="inline-flex items-center rounded-full bg-purple-950/20 px-2 py-1 text-xs font-medium text-purple-400 font-mono">
                                                ADMIN
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-500 font-mono">
                                                USER
                                            </span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 font-mono">
                                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </td>
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/dashboard/users/${user.id}`}
                                                className="rounded-lg border border-transparent p-2 hover:bg-white/10 hover:text-white text-zinc-500 transition-all"
                                                title="View User"
                                            >
                                                <UserIcon className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {users.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-zinc-500 font-mono text-sm">No users found.</p>
                        </div>
                    )}
                </div>
            </div>

            <Pagination totalPages={totalPages} />
        </div>
    )
}
