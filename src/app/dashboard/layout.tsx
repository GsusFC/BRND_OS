import { Sidebar } from "@/components/dashboard/Sidebar"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import { AdminUserProvider } from "@/hooks/use-admin-user"
import { Web3ClientProvider } from "@/components/providers/Web3ClientProvider"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Web3ClientProvider>
            <AdminUserProvider>
                <div className="flex h-dvh bg-background text-foreground font-sans selection:bg-white selection:text-black">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto bg-background">
                        <div className="container mx-auto p-8 max-w-screen-2xl">
                            <PermissionGuard>
                                {children}
                            </PermissionGuard>
                        </div>
                    </main>
                </div>
            </AdminUserProvider>
        </Web3ClientProvider>
    )
}
