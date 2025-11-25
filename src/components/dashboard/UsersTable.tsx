import prisma from "@/lib/prisma"
import { MoreHorizontal } from "lucide-react"
import Image from "next/image"
import { Pagination } from "@/components/ui/Pagination"

interface User {
    id: number
    username: string
    photoUrl: string | null
    fid: number
    points: number
    role: string
}

export async function UsersTable({
    query,
    currentPage,
}: {
    query: string
    currentPage: number
}) {
    const ITEMS_PER_PAGE = 10
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    // MySQL no soporta mode: 'insensitive', usa contains directamente
    const whereClause = query
        ? {
            OR: [
                { username: { contains: query } },
                { address: { contains: query } },
            ],
        }
        : {}

    let users: User[] = [];
    let totalCount = 0;

    try {
        [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                orderBy: { points: "desc" },
                take: ITEMS_PER_PAGE,
                skip: offset,
            }),
            prisma.user.count({ where: whereClause })
        ]);
    } catch (error) {
        console.warn("⚠️ Could not fetch users from database:", error instanceof Error ? error.message : error);
        // Continue with empty arrays
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    return (
        <div className="mt-6 flow-root">
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full">
                        <thead className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                            <tr>
                                <th scope="col" className="px-4 py-4 font-bold sm:pl-6">
                                    User
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Points
                                </th>
                                <th scope="col" className="px-3 py-4 font-bold">
                                    Role
                                </th>
                                <th scope="col" className="relative py-3 pl-6 pr-3">
                                    <span className="sr-only">Edit</span>
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
                                        <div className="flex items-center gap-3">
                                            {user.photoUrl ? (
                                                <Image
                                                    src={user.photoUrl}
                                                    className="rounded-full ring-1 ring-border"
                                                    width={32}
                                                    height={32}
                                                    alt={`${user.username}'s profile picture`}
                                                />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-zinc-800 ring-1 ring-border" />
                                            )}
                                            <div className="flex flex-col">
                                                <p className="font-medium text-zinc-300 flex items-center gap-1 font-sans group-hover:text-white transition-colors">
                                                    {user.username}
                                                </p>
                                                <p className="text-xs text-zinc-600 font-mono">FID: {user.fid}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 font-mono text-sm text-zinc-400">
                                        {user.points.toLocaleString()}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium font-mono ${user.role === 'admin' ? 'bg-purple-950/20 text-purple-400' : 'bg-zinc-900 text-zinc-500'}`}>
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex justify-end gap-3">
                                            <button className="rounded-lg border border-transparent p-2 hover:bg-white/10 hover:text-white text-zinc-500 transition-all">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination totalPages={totalPages} />
        </div>
    )
}
