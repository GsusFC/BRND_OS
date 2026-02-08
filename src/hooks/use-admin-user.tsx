"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { AdminUser } from "@/lib/auth/permissions"
import { hasPermission, hasAnyPermission } from "@/lib/auth/permissions"

interface UseAdminUserReturn {
    user: AdminUser | null
    loading: boolean
    error: string | null
    hasPermission: (permission: string) => boolean
    hasAnyPermission: (permissions: string[]) => boolean
    isAdmin: boolean
}

const AdminUserContext = createContext<UseAdminUserReturn | null>(null)

function useAdminUserState(): UseAdminUserReturn {
    const [user, setUser] = useState<AdminUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const sessionRes = await fetch("/api/auth/session", { cache: "no-store" })
                const sessionJson: unknown = await sessionRes.json().catch(() => null)

                const session = sessionJson as {
                    user?: {
                        fid?: number
                        role?: string
                        name?: string | null
                        image?: string | null
                    }
                } | null

                const fid = session?.user?.fid
                const role = session?.user?.role

                if (typeof fid !== "number") {
                    setError("Not authenticated")
                    return
                }

                if (role === "admin") {
                    setUser({
                        fid,
                        username: typeof session?.user?.name === "string" && session.user.name.trim().length > 0
                            ? session.user.name
                            : `fid-${fid}`,
                        avatar: typeof session?.user?.image === "string" ? session.user.image : null,
                        role: "admin",
                        permissions: ["all"],
                        is_active: true,
                    })
                    return
                }

                const response = await fetch(`/api/admin/access/${fid}`, { cache: "no-store" })
                if (response.ok) {
                    const data = await response.json()
                    setUser(data.user)
                    return
                }

                if (response.status === 404) {
                    setError("You don't have admin access to this system")
                    return
                }

                if (response.status === 401) {
                    setError("Not authenticated")
                    return
                }

                if (response.status === 403) {
                    setError("Insufficient permissions")
                    return
                }

                setError("Failed to verify admin access")
            } catch (err) {
                console.error("Error fetching admin user:", err)
                setError("Network error")
            } finally {
                setLoading(false)
            }
        }

        fetchCurrentUser()
    }, [])

    return useMemo(
        () => ({
            user,
            loading,
            error,
            hasPermission: (permission: string) => hasPermission(user, permission),
            hasAnyPermission: (permissions: string[]) => hasAnyPermission(user, permissions),
            isAdmin: user?.role === "admin" || user?.permissions.includes("all") || false,
        }),
        [user, loading, error]
    )
}

export function AdminUserProvider({ children }: { children: ReactNode }) {
    const value = useAdminUserState()
    return <AdminUserContext.Provider value={value}>{children}</AdminUserContext.Provider>
}

/**
 * Hook to get current admin user and check permissions.
 * Must be used under AdminUserProvider.
 */
export function useAdminUser(): UseAdminUserReturn {
    const context = useContext(AdminUserContext)
    if (!context) {
        throw new Error("useAdminUser must be used within AdminUserProvider")
    }
    return context
}
