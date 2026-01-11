import { AdminUser } from "./permissions"
import { createClient, type InValue } from "@libsql/client"

const getTursoClient = () => {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
        throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be defined')
    }
    
    return createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    })
}

/**
 * Server-only function to get admin user by FID
 * Only use this in API routes or server components
 */
export async function getAdminUser(fid: number): Promise<AdminUser | null> {
    try {
        const client = getTursoClient()
        const result = await client.execute({
            sql: 'SELECT fid, username, avatar, role, permissions, is_active FROM admin_users WHERE fid = ? AND is_active = 1',
            args: [fid]
        })

        if (result.rows.length === 0) {
            return null
        }

        const row = result.rows[0]
        const user: AdminUser = {
            fid: row.fid as number,
            username: row.username as string,
            avatar: row.avatar as string | null,
            role: row.role as string,
            permissions: row.permissions ? JSON.parse(row.permissions as string) : [],
            is_active: Boolean(row.is_active)
        }
        return user
    } catch (error) {
        console.error("[getAdminUser] Error fetching admin user:", error)
        return null
    }
}

/**
 * Server-only function to get all admin users
 */
export async function getAllAdminUsers(): Promise<AdminUser[]> {
    try {
        const client = getTursoClient()
        const result = await client.execute(
            'SELECT fid, username, avatar, role, permissions, is_active FROM admin_users ORDER BY created_at DESC'
        )

        return result.rows.map(row => ({
            fid: row.fid as number,
            username: row.username as string,
            avatar: row.avatar as string | null,
            role: row.role as string,
            permissions: row.permissions ? JSON.parse(row.permissions as string) : [],
            is_active: Boolean(row.is_active)
        }))
    } catch (error) {
        console.error("Error fetching admin users:", error)
        return []
    }
}

/**
 * Server-only function to create admin user
 */
export async function createAdminUser(userData: {
    fid: number
    username: string
    role: string
    avatar?: string
    permissions?: string[]
}): Promise<AdminUser | null> {
    try {
        const { fid, username, role, avatar, permissions } = userData

        // Default permissions based on role
        const defaultPermissions = {
            admin: ["dashboard", "intelligence", "users", "brands", "season-1", "applications", "allowlist", "add-brands", "access-control"],
            viewer: ["dashboard", "intelligence", "users", "brands", "season-1"],
            limited: ["dashboard", "intelligence"]
        }

        const userPermissions = permissions || defaultPermissions[role as keyof typeof defaultPermissions] || []

        const client = getTursoClient()
        await client.execute({
            sql: 'INSERT INTO admin_users (fid, username, avatar, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            args: [fid, username, avatar || null, role, JSON.stringify(userPermissions)]
        })

        return {
            fid,
            username,
            avatar: avatar || null,
            role,
            permissions: userPermissions,
            is_active: true
        }
    } catch (error) {
        console.error("Error creating admin user:", error)
        return null
    }
}

/**
 * Server-only function to update admin user
 */
export async function updateAdminUser(fid: number, updateData: {
    role?: string
    permissions?: string[]
    is_active?: boolean
    username?: string
    avatar?: string | null
}): Promise<AdminUser | null> {
    try {
        const client = getTursoClient()
        
        // Build update query dynamically
        const updates: string[] = []
        const args: InValue[] = []
        
        if (updateData.role !== undefined) {
            updates.push('role = ?')
            args.push(updateData.role)
        }
        
        if (updateData.permissions !== undefined) {
            updates.push('permissions = ?')
            args.push(JSON.stringify(updateData.permissions))
        }
        
        if (updateData.is_active !== undefined) {
            updates.push('is_active = ?')
            args.push(updateData.is_active ? 1 : 0)
        }

        if (updateData.username !== undefined) {
            updates.push('username = ?')
            args.push(updateData.username)
        }

        if (updateData.avatar !== undefined) {
            updates.push('avatar = ?')
            args.push(updateData.avatar)
        }
        
        if (updates.length === 0) {
            // No updates to make, return current user
            return await getAdminUser(fid)
        }
        
        args.push(fid) // For WHERE clause
        
        await client.execute({
            sql: `UPDATE admin_users SET ${updates.join(', ')} WHERE fid = ?`,
            args
        })

        return await getAdminUser(fid)
    } catch (error) {
        console.error("Error updating admin user:", error)
        return null
    }
}

/**
 * Server-only function to delete admin user
 */
export async function deleteAdminUser(fid: number): Promise<boolean> {
    try {
        const client = getTursoClient()
        await client.execute({
            sql: 'DELETE FROM admin_users WHERE fid = ?',
            args: [fid]
        })
        return true
    } catch (error) {
        console.error("Error deleting admin user:", error)
        return false
    }
}