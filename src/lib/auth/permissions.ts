export interface AdminUser {
    fid: number
    username: string
    avatar?: string | null
    role: string
    permissions: string[]
    is_active: boolean
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: AdminUser | null, permission: string): boolean {
    if (!user || !user.is_active) return false
    
    // Admins have all permissions
    if (user.role === "admin" || user.permissions.includes("all")) return true
    
    // Check specific permission
    return user.permissions.includes(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: AdminUser | null, permissions: string[]): boolean {
    if (!user || !user.is_active) return false
    
    // Admins have all permissions
    if (user.role === "admin" || user.permissions.includes("all")) return true
    
    // Check if user has any of the specified permissions
    return permissions.some(permission => user.permissions.includes(permission))
}

/**
 * Permission definitions for different sections
 */
export const PERMISSIONS = {
    // Core dashboard sections
    DASHBOARD: "dashboard",
    INTELLIGENCE: "intelligence",
    
    // Data viewing permissions
    USERS: "users",
    BRANDS: "brands",
    SEASON_1: "season-1",
    COLLECTIBLES: "collectibles",
    
    // Admin permissions
    APPLICATIONS: "applications",
    TOKEN_GATE: "allowlist",
    ACCESS_CONTROL: "access-control"
} as const

/**
 * Get required permissions for different routes
 */
export function getRequiredPermissions(pathname: string): string[] {
    // Core dashboard routes
    if (pathname === "/dashboard") return [PERMISSIONS.DASHBOARD]
    if (pathname.startsWith("/dashboard/intelligence")) return [PERMISSIONS.INTELLIGENCE]
    
    // Data routes
    if (pathname.startsWith("/dashboard/users")) return [PERMISSIONS.USERS]
    if (pathname.startsWith("/dashboard/brands")) return [PERMISSIONS.BRANDS]
    if (pathname.startsWith("/dashboard/collectibles")) return [PERMISSIONS.COLLECTIBLES]
    if (pathname.startsWith("/dashboard/season-1")) return [PERMISSIONS.SEASON_1]
    
    // Admin routes
    if (pathname.startsWith("/dashboard/applications")) return [PERMISSIONS.APPLICATIONS]
    if (pathname.startsWith("/dashboard/allowlist")) return [PERMISSIONS.TOKEN_GATE]
    if (pathname.startsWith("/dashboard/admin/access")) return [PERMISSIONS.ACCESS_CONTROL]
    
    // Default: require dashboard access
    return [PERMISSIONS.DASHBOARD]
}

/**
 * Role-based default permissions
 */
export const DEFAULT_ROLE_PERMISSIONS = {
    admin: ["all"],
    viewer: [PERMISSIONS.DASHBOARD, PERMISSIONS.INTELLIGENCE, PERMISSIONS.USERS, PERMISSIONS.BRANDS, PERMISSIONS.SEASON_1, PERMISSIONS.COLLECTIBLES],
    limited: [PERMISSIONS.DASHBOARD, PERMISSIONS.INTELLIGENCE]
} as const
