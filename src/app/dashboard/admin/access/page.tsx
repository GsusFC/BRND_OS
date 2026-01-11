"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, RotateCw, Search, Settings, Trash2, Users } from "lucide-react"
import { AddUserModal } from "@/components/admin/AddUserModal"
import { PermissionEditor } from "@/components/admin/PermissionEditor"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const dynamic = 'force-dynamic'

interface User {
    fid: number
    username: string
    avatar?: string | null
    role: string
    permissions: string[]
    last_login?: Date
    is_active: boolean
    created_at?: Date
}

const COMPACT_BADGE_CLASSNAME = "px-2 py-0.5 text-[10px] rounded-md"
const MAX_VISIBLE_PERMISSIONS = 2
const PAGE_SIZE = 25

const getPermissionsDisplayParts = (permissions: string[]) => {
    const safe = Array.isArray(permissions) ? permissions : []

    if (safe.includes("all")) {
        return {
            isAll: true,
            visible: ["all"],
            hidden: [],
        }
    }

    return {
        isAll: false,
        visible: safe.slice(0, MAX_VISIBLE_PERMISSIONS),
        hidden: safe.slice(MAX_VISIBLE_PERMISSIONS),
    }
}

function getRoleBadge(role: string) {
    switch (role) {
        case "admin":
            return <Badge variant="destructive" className={COMPACT_BADGE_CLASSNAME}>Admin</Badge>
        case "viewer":
            return <Badge variant="info" className={COMPACT_BADGE_CLASSNAME}>Viewer</Badge>
        case "limited":
            return <Badge variant="warning" className={COMPACT_BADGE_CLASSNAME}>Limited</Badge>
        default:
            return <Badge className={COMPACT_BADGE_CLASSNAME}>{role}</Badge>
    }
}

function formatLastSeen(date: Date | string | undefined | null) {
    if (!date) return "Never"
    
    const lastSeen = new Date(date)
    const now = Date.now()
    const diff = now - lastSeen.getTime()
    
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return lastSeen.toLocaleDateString()
}

export default function AccessControlPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isPermissionEditorOpen, setIsPermissionEditorOpen] = useState(false)
    const [deletingFid, setDeletingFid] = useState<number | null>(null)
    const [syncingFid, setSyncingFid] = useState<number | null>(null)
    const [page, setPage] = useState(0)

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.fid.toString().includes(searchTerm)
    )

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages - 1)
    const startIndex = currentPage * PAGE_SIZE
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredUsers.length)
    const pagedUsers = filteredUsers.slice(startIndex, endIndex)

    const stats = {
        total: users.length,
        admin: users.filter(u => u.role === "admin").length,
        viewer: users.filter(u => u.role === "viewer").length,
        limited: users.filter(u => u.role === "limited").length,
        active: users.filter(u => u.is_active).length,
        recent: users.filter(u => {
            if (!u.last_login) return false
            const diff = Date.now() - new Date(u.last_login).getTime()
            return diff < 3600000 // Last hour
        }).length
    }

    const fetchUsers = async (opts?: { initial?: boolean }) => {
        const initial = opts?.initial === true
        try {
            setLoadError(null)
            if (initial) setLoading(true)
            else setIsRefreshing(true)

            const response = await fetch("/api/admin/access")
            if (response.ok) {
                const data = await response.json()
                setUsers(data.users || [])
            } else {
                const body = await response.json().catch(() => null)
                const message = typeof body?.error === "string" ? body.error : `Failed to fetch users (HTTP ${response.status})`
                setLoadError(message)
                toast.error(message)
            }
        } catch (error) {
            console.error("Error fetching users:", error)
            const message = error instanceof Error ? error.message : "Network error"
            setLoadError(message)
            toast.error(message)
        } finally {
            if (initial) setLoading(false)
            else setIsRefreshing(false)
        }
    }

    useEffect(() => {
        fetchUsers({ initial: true })
    }, [])

    useEffect(() => {
        setPage(0)
    }, [searchTerm])

    useEffect(() => {
        if (page === currentPage) return
        setPage(currentPage)
    }, [page, currentPage])

    const handleAddUser = async (userData: { fid: number; username: string; role: string; avatar?: string }): Promise<boolean> => {
        try {
            const response = await fetch("/api/admin/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            })

            if (response.ok) {
                const data = await response.json()
                setUsers(prev => [...prev, data.user])
                toast.success("Usuario añadido")
                return true
            } else {
                const body = await response.json().catch(() => null)
                const message = typeof body?.error === "string" ? body.error : `Failed to add user (HTTP ${response.status})`
                toast.error(message)
                return false
            }
        } catch (error) {
            console.error("Error adding user:", error)
            toast.error(error instanceof Error ? error.message : "Network error")
            return false
        }
    }

    const handleEditPermissions = (user: User) => {
        setSelectedUser(user)
        setIsPermissionEditorOpen(true)
    }

    const handleSavePermissions = async (updatedUser: User): Promise<boolean> => {
        try {
            const response = await fetch(`/api/admin/access/${updatedUser.fid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: updatedUser.role,
                    permissions: updatedUser.permissions
                })
            })

            if (response.ok) {
                const data = await response.json()
                setUsers(prev => prev.map(u => u.fid === updatedUser.fid ? data.user : u))
                setSelectedUser(null)
                toast.success("Permisos guardados")
                return true
            } else {
                const body = await response.json().catch(() => null)
                const message = typeof body?.error === "string" ? body.error : `Failed to update user (HTTP ${response.status})`
                toast.error(message)
                return false
            }
        } catch (error) {
            console.error("Error updating user:", error)
            toast.error(error instanceof Error ? error.message : "Network error")
            return false
        }
    }

    const handleRemoveUser = async (fid: number) => {
        if (!confirm("Are you sure you want to remove this user's access?")) return

        try {
            setDeletingFid(fid)
            const response = await fetch(`/api/admin/access/${fid}`, {
                method: "DELETE"
            })

            if (response.ok) {
                setUsers(prev => prev.filter(u => u.fid !== fid))
                toast.success("Acceso revocado")
            } else {
                const body = await response.json().catch(() => null)
                const message = typeof body?.error === "string" ? body.error : `Failed to remove user (HTTP ${response.status})`
                toast.error(message)
            }
        } catch (error) {
            console.error("Error removing user:", error)
            toast.error(error instanceof Error ? error.message : "Network error")
        } finally {
            setDeletingFid(null)
        }
    }

    const handleSyncUser = async (fid: number) => {
        if (syncingFid !== null) return

        try {
            setSyncingFid(fid)
            const response = await fetch(`/api/admin/access/${fid}/sync`, {
                method: "POST",
                cache: "no-store",
            })

            const body = await response.json().catch(() => null)

            if (!response.ok) {
                const message = typeof body?.error === "string" ? body.error : `Sync failed (HTTP ${response.status})`
                toast.error(message)
                return
            }

            const updatedUser = body?.user as User | undefined
            if (updatedUser && typeof updatedUser.fid === "number") {
                setUsers(prev => prev.map(u => u.fid === updatedUser.fid ? updatedUser : u))
            } else {
                await fetchUsers({ initial: false })
            }

            toast.success("Perfil sincronizado")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Network error")
        } finally {
            setSyncingFid(null)
        }
    }

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white font-display uppercase">
                            Access Management
                        </h1>
                        <p className="text-zinc-500 mt-1 text-sm font-mono">
                            Loading user access data...
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white font-display uppercase">
                        Access Management
                    </h1>
                    <p className="text-zinc-500 mt-1 text-xs font-mono">
                        Manage who can access the BRND Admin Dashboard
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <Input
                            placeholder="Search username / FID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-9 text-sm"
                        />
                    </div>

                    <Button
                        onClick={() => fetchUsers({ initial: false })}
                        variant="secondary"
                        disabled={isRefreshing}
                        aria-label="Refresh"
                        className="h-9"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            Refresh
                        </span>
                    </Button>

                    <Button
                        onClick={() => setIsAddModalOpen(true)}
                        variant="brand"
                        className="h-9"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add
                        </span>
                    </Button>
                </div>
            </div>

            {loadError && (
                <Card className="p-4 gap-3">
                    <CardContent className="px-0 py-0">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="font-medium text-white">No se pudo cargar la lista</p>
                                <p className="text-sm text-zinc-500 font-mono mt-1">{loadError}</p>
                            </div>
                            <Button onClick={() => fetchUsers({ initial: false })} variant="secondary">
                                Reintentar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <Card className="p-3 gap-2">
                <CardContent className="px-0 py-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={COMPACT_BADGE_CLASSNAME}>Total {stats.total}</Badge>
                        <Badge variant="destructive" className={COMPACT_BADGE_CLASSNAME}>Admin {stats.admin}</Badge>
                        <Badge variant="info" className={COMPACT_BADGE_CLASSNAME}>Viewer {stats.viewer}</Badge>
                        <Badge variant="warning" className={COMPACT_BADGE_CLASSNAME}>Limited {stats.limited}</Badge>
                        <Badge variant="success" className={COMPACT_BADGE_CLASSNAME}>Active {stats.active}</Badge>
                        <Badge variant="default" className={COMPACT_BADGE_CLASSNAME}>Recent {stats.recent}</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Search */}
            <div />

            {/* Users Table */}
            <Card className="p-4 gap-3">
                <CardTitle className="text-xs">Admin Users ({filteredUsers.length})</CardTitle>
                <CardContent className="px-0">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                            <p className="text-zinc-400">No users found matching your search</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-700">
                                        <th className="text-left px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">User</th>
                                        <th className="text-left px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Role</th>
                                        <th className="text-left px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Permissions</th>
                                        <th className="text-left px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Last Seen</th>
                                        <th className="text-left px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Status</th>
                                        <th className="text-right px-3 py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedUsers.map((user) => (
                                        <tr key={user.fid} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-3">
                                                    {user.avatar ? (
                                                        <Image
                                                            src={user.avatar}
                                                            alt={user.username}
                                                            width={24}
                                                            height={24}
                                                            sizes="24px"
                                                            className="w-6 h-6 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-medium">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-sm leading-tight">@{user.username}</p>
                                                        <p className="text-[10px] text-zinc-600 font-mono leading-tight">FID {user.fid}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {getRoleBadge(user.role)}
                                            </td>
                                            <td className="px-3 py-2">
                                                {(() => {
                                                    const parts = getPermissionsDisplayParts(user.permissions)

                                                    if (parts.isAll) {
                                                        return (
                                                            <Badge variant="destructive" className={COMPACT_BADGE_CLASSNAME}>
                                                                All
                                                            </Badge>
                                                        )
                                                    }

                                                    return (
                                                        <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                                                            {parts.visible.map((permission) => (
                                                                <Badge
                                                                    key={permission}
                                                                    variant="outline"
                                                                    className={COMPACT_BADGE_CLASSNAME}
                                                                >
                                                                    {permission}
                                                                </Badge>
                                                            ))}

                                                            {parts.hidden.length > 0 && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <button
                                                                            type="button"
                                                                            className="focus:outline-none"
                                                                            aria-label={`Ver ${parts.hidden.length} permisos más`}
                                                                        >
                                                                            <Badge variant="default" className={COMPACT_BADGE_CLASSNAME}>
                                                                                +{parts.hidden.length}
                                                                            </Badge>
                                                                        </button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent sideOffset={6}>
                                                                        <p className="max-w-[320px] whitespace-normal">
                                                                            {parts.hidden.join(", ")}
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="text-[10px] font-mono text-zinc-500">
                                                    {formatLastSeen(user.last_login)}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <Badge variant={user.is_active ? "success" : "default"} className={COMPACT_BADGE_CLASSNAME}>
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSyncUser(user.fid)}
                                                        disabled={syncingFid === user.fid}
                                                        aria-label={`Sincronizar perfil de @${user.username}`}
                                                        className="h-8 w-8 px-0 text-zinc-500 hover:text-white"
                                                    >
                                                        <RotateCw className={`w-4 h-4 ${syncingFid === user.fid ? "animate-spin" : ""}`} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditPermissions(user)}
                                                        aria-label={`Editar permisos de @${user.username}`}
                                                        className="h-8 w-8 px-0"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </Button>
                                                    {user.role !== "admin" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveUser(user.fid)}
                                                            disabled={deletingFid === user.fid}
                                                            className="h-8 w-8 px-0 text-red-400 hover:text-red-300"
                                                            aria-label={`Revocar acceso de @${user.username}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {filteredUsers.length > 0 && (
                        <div className="flex items-center justify-between pt-3 text-[10px] font-mono text-zinc-600">
                            <span>
                                Showing {startIndex + 1}-{endIndex} of {filteredUsers.length}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                >
                                    Prev
                                </Button>
                                <span>
                                    Page {currentPage + 1}/{totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={currentPage >= totalPages - 1}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddUserModal 
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAddUser={handleAddUser}
            />

            <PermissionEditor
                user={selectedUser}
                isOpen={isPermissionEditorOpen}
                onClose={() => {
                    setIsPermissionEditorOpen(false)
                    setSelectedUser(null)
                }}
                onSave={handleSavePermissions}
            />

        </div>
    )
}