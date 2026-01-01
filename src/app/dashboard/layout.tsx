import { Sidebar } from "@/components/dashboard/Sidebar"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen bg-background text-foreground font-sans selection:bg-white selection:text-black">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-background">
                <div className="container mx-auto p-8 max-w-screen-2xl">
                    {children}
                </div>
            </main>
        </div>
    )
}
