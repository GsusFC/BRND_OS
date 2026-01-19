import { Suspense } from 'react'
import { getDashboardStats } from '@/lib/dashboard/stats'
import { DashboardAnalytics } from './DashboardAnalytics'
import { DashboardAnalyticsSkeleton } from './DashboardAnalyticsSkeleton'

async function DashboardAnalyticsData() {
    const stats = await getDashboardStats()

    return (
        <DashboardAnalytics
            initialData={stats}
        />
    )
}

export function DashboardAnalyticsServer() {
    return (
        <Suspense fallback={<DashboardAnalyticsSkeleton />}>
            <DashboardAnalyticsData />
        </Suspense>
    )
}
