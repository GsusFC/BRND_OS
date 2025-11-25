"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Trophy, Gift, LogOut, Brain, Plus } from "lucide-react"
import { signOut } from "next-auth/react"
import clsx from "clsx"
import Image from "next/image"

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/dashboard/users", icon: Users },
    { name: "Brands", href: "/dashboard/brands", icon: Trophy },
    { name: "Airdrops", href: "/dashboard/airdrops", icon: Gift },
    { name: "Intelligence", href: "/dashboard/intelligence", icon: Brain },
]

export function Sidebar() {
    const pathname = usePathname()

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
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={clsx(
                                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-surface text-white"
                                    : "text-zinc-400 hover:text-white hover:bg-surface/50"
                            )}
                        >
                            <item.icon className={clsx("h-4 w-4", isActive ? "text-white" : "text-zinc-500 group-hover:text-white")} />
                            {item.name}
                        </Link>
                    )
                })}
            </div>

            <div className="p-4 space-y-3">
                {/* Add Brand Button with Gradient */}
                <Link
                    href="/dashboard/brands/new"
                    className="btn-brand-gradient flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-black font-display uppercase tracking-wide !text-white hover:!text-white"
                >
                    <Plus className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">Add Brand</span>
                </Link>

                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/10 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </div>
    )
}
