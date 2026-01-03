/**
 * Types para el sistema de cache
 */

// Brand metadata cacheado
export interface BrandMetadata {
    id: number
    name: string
    imageUrl: string | null
    channel: string | null
}

// User metadata cacheado
export interface UserMetadata {
    fid: number
    username: string | null
    displayName: string | null
    pfpUrl: string | null
}

// Dashboard stats cacheado
export interface DashboardStats {
    userCount: number
    brandCount: number
    voteCount: number
    votesToday: number
    votesThisWeek: number
    activeUsers: number
    roundNumber: number
    connectionError: boolean
}

// Recent votes cacheado
export interface RecentVote {
    id: string
    odiumId: number
    username: string
    photoUrl: string | null
    brand1: { id: number; name: string }
    brand2: { id: number; name: string }
    brand3: { id: number; name: string }
    date: Date
}

// Analytics data cacheado
export interface AnalyticsData {
    votesPerDay: Array<{ date: string; count: number }>
    topVoters: Array<{
        userId: number
        voteCount: number
        username: string
        photoUrl: string | null
        points: number
    }>
    trending: Array<{
        id: number
        name: string
        imageUrl: string | null
        thisWeek: number
        lastWeek: number
        growth: number
    }>
    categoryDistribution: Array<{ name: string; count: number }>
    newUsers: {
        thisWeek: number
        lastWeek: number
        growth: number
    }
    engagement: {
        totalUsers: number
        activeUsersWeek: number
        activeRate: number
        avgVotesPerUser: number
        retentionRate: number
    }
    votesByHour: Array<{ hour: number; count: number }>
}

// Cache metadata
export interface CacheMetadata {
    key: string
    cachedAt: number
    expiresAt: number
    hitCount?: number
}

// Cache statistics
export interface CacheStats {
    hits: number
    misses: number
    hitRate: number
    totalKeys: number
    memoryUsed?: number
}
