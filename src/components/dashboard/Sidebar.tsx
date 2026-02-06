"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Trophy, LogOut, Brain, Home, ShieldCheck, Palette, Database, Clock, Settings, Gem } from "lucide-react"
import { signOut } from "next-auth/react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useAdminUser } from "@/hooks/use-admin-user"
import { PERMISSIONS } from "@/lib/auth/permissions"

const navigationItems = [
    { 
        name: "Overview", 
        path: "", 
        icon: LayoutDashboard,
        permissions: [PERMISSIONS.DASHBOARD]
    },
    { 
        name: "Users", 
        path: "/users", 
        icon: Users,
        permissions: [PERMISSIONS.USERS]
    },
    { 
        name: "Brands", 
        path: "/brands", 
        icon: Trophy,
        permissions: [PERMISSIONS.BRANDS]
    },
    { 
        name: "Collectibles", 
        path: "/collectibles", 
        icon: Gem,
        permissions: [PERMISSIONS.COLLECTIBLES]
    },
    { 
        name: "Collectibles V3", 
        path: "/collectibles-v3", 
        icon: Gem,
        permissions: [PERMISSIONS.COLLECTIBLES]
    },
    { 
        name: "Applications", 
        path: "/applications", 
        icon: Clock,
        permissions: [PERMISSIONS.APPLICATIONS]
    },
    { 
        name: "Token Gate", 
        path: "/allowlist", 
        icon: ShieldCheck,
        permissions: [PERMISSIONS.TOKEN_GATE]
    },
    { 
        name: "Intelligence", 
        path: "/intelligence", 
        icon: Brain,
        permissions: [PERMISSIONS.INTELLIGENCE]
    },
    { 
        name: "Season 1", 
        path: "/season-1", 
        icon: Database,
        permissions: [PERMISSIONS.SEASON_1]
    },
    { 
        name: "Access Control", 
        path: "/admin/access", 
        icon: Settings,
        permissions: [PERMISSIONS.ACCESS_CONTROL]
    },
    { 
        name: "Design System", 
        path: "/design-system", 
        icon: Palette,
        permissions: [PERMISSIONS.DASHBOARD] // Design system accessible to all dashboard users
    },
]

export function Sidebar() {
    const pathname = usePathname()
    const basePath = "/dashboard"
    const { hasAnyPermission } = useAdminUser()

    // Filter navigation items based on user permissions
    const navigation = navigationItems
        .filter(item => hasAnyPermission(item.permissions))
        .map(item => ({
            ...item,
            href: item.name === "Season 1" ? `${basePath}/season-1` : (item.path ? `${basePath}${item.path}` : basePath),
        }))

    return (
        <div className="flex h-full w-64 flex-col bg-background">
            <div className="flex h-16 items-center px-6">
                <Image
                    src="/logo.svg"
                    alt="BRND Logo"
                    width={100}
                    height={32}
                    className="h-8 w-auto"
                    priority
                />
            </div>

            <div className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
                <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
                    Menu
                </div>
                {navigation.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.path && item.path !== "" && pathname.startsWith(`${item.href}/`))
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-zinc-500 group-hover:text-white")} />
                            {item.name}
                        </Link>
                    )
                })}
            </div>

            <div className="p-4 space-y-3">
                <Link
                    href="/"
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-colors"
                >
                    <Home className="h-4 w-4" />
                    About
                </Link>

                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/10 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </div>
    )
}
