"use client"

import { useAdminUser } from "@/hooks/use-admin-user"
import { getRequiredPermissions } from "@/lib/auth/permissions"
import { usePathname } from "next/navigation"
import { Shield, Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface PermissionGuardProps {
    children: React.ReactNode
    requiredPermissions?: string[]
    fallback?: React.ReactNode
}

/**
 * Component that checks if user has required permissions to view content
 */
export function PermissionGuard({ 
    children, 
    requiredPermissions,
    fallback 
}: PermissionGuardProps) {
    const { user, loading, error, hasAnyPermission } = useAdminUser()
    const pathname = usePathname()
    
    // Get required permissions for current route if not specified
    const permissions = requiredPermissions || getRequiredPermissions(pathname)
    
    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verifying access...</p>
                </div>
            </div>
        )
    }
    
    // Show error state
    if (error || !user) {
        return fallback || (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-zinc-400 mb-6">
                            {error || "You don't have permission to access this page."}
                        </p>
                        <Button 
                            variant="secondary" 
                            onClick={() => window.location.href = "/dashboard"}
                        >
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }
    
    // Check permissions
    const hasAccess = hasAnyPermission(permissions)
    
    if (!hasAccess) {
        return fallback || (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Insufficient Permissions</h2>
                        <p className="text-zinc-400 mb-4">
                            You need one of the following permissions to view this page:
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                            {permissions.map(permission => (
                                <span 
                                    key={permission}
                                    className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm"
                                >
                                    {permission}
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-500 mb-6">
                            Contact an administrator if you believe you should have access.
                        </p>
                        <Button 
                            variant="secondary" 
                            onClick={() => window.location.href = "/dashboard"}
                        >
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }
    
    return <>{children}</>
}

/**
 * Simple permission check component for conditional rendering
 */
export function PermissionCheck({ 
    requiredPermissions,
    children,
    fallback 
}: {
    requiredPermissions: string[]
    children: React.ReactNode
    fallback?: React.ReactNode
}) {
    const { hasAnyPermission } = useAdminUser()
    
    if (!hasAnyPermission(requiredPermissions)) {
        return <>{fallback}</>
    }
    
    return <>{children}</>
}

/**
 * Component to show user info and current permissions
 */
export function UserPermissionInfo() {
    const { user, isAdmin } = useAdminUser()
    
    if (!user) return null
    
    return (
        <div className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="p-2 bg-zinc-800 rounded-full">
                <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium">@{user.username}</p>
                <p className="text-xs text-zinc-400">
                    {isAdmin ? "Full Admin Access" : `${user.permissions.length} permissions`}
                </p>
            </div>
            <div className={`px-2 py-1 text-xs rounded ${
                user.role === "admin" ? "bg-red-500/20 text-red-400" :
                user.role === "viewer" ? "bg-blue-500/20 text-blue-400" :
                "bg-yellow-500/20 text-yellow-400"
            }`}>
                {user.role}
            </div>
        </div>
    )
}