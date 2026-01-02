"use server"

import { incrementCounter, recordLatency } from "@/lib/metrics"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
const NEYNAR_BASE_URL = "https://api.neynar.com/v2/farcaster"
const NEYNAR_TIMEOUT_MS = Number(process.env.NEYNAR_TIMEOUT_MS ?? 4000)

const isValidAbsoluteUrl = (value: string): boolean => {
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

const normalizeChannelUrl = (channelId: string, rawUrl: string): string => {
    const trimmed = rawUrl.trim()
    if (!trimmed) {
        return `https://warpcast.com/~/channel/${channelId}`
    }

    if (isValidAbsoluteUrl(trimmed)) {
        return trimmed
    }

    if (trimmed.startsWith("warpcast.com/")) {
        const candidate = `https://${trimmed}`
        if (isValidAbsoluteUrl(candidate)) return candidate
    }

    if (trimmed.startsWith("www.warpcast.com/")) {
        const candidate = `https://${trimmed.replace(/^www\./, "")}`
        if (isValidAbsoluteUrl(candidate)) return candidate
    }

    if (trimmed.startsWith("/")) {
        const candidate = `https://warpcast.com${trimmed}`
        if (isValidAbsoluteUrl(candidate)) return candidate
    }

    return `https://warpcast.com/~/channel/${channelId}`
}

interface NeynarUser {
    fid: number
    username: string
    display_name: string
    pfp_url: string
    profile: {
        bio: {
            text: string
        }
    }
    follower_count: number
    following_count: number
    verifications: string[]
    active_status: string
    power_badge: boolean
    experimental?: {
        neynar_user_score?: number
    }
}

interface NeynarChannel {
    id: string
    url: string
    name: string
    description: string
    image_url: string
    follower_count: number
    object: string
    lead?: {
        fid: number
        username: string
        display_name: string
        pfp_url: string
    }
}

async function neynarFetch<T>(endpoint: string): Promise<T> {
    const startMs = Date.now()
    let ok = false

    if (!NEYNAR_API_KEY) {
        throw new Error("NEYNAR_API_KEY is not configured")
    }

    if (!Number.isFinite(NEYNAR_TIMEOUT_MS) || NEYNAR_TIMEOUT_MS <= 0) {
        throw new Error(`Invalid NEYNAR_TIMEOUT_MS: ${String(process.env.NEYNAR_TIMEOUT_MS)}`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NEYNAR_TIMEOUT_MS)

    let response: Response
    try {
        try {
            response = await fetch(`${NEYNAR_BASE_URL}${endpoint}`, {
                method: "GET",
                headers: {
                    "x-api-key": NEYNAR_API_KEY,
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
            })
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                await incrementCounter("neynar.timeout")
                throw new Error(`Neynar API timeout after ${NEYNAR_TIMEOUT_MS}ms`)
            }
            await incrementCounter("neynar.fetch_error")
            throw error
        } finally {
            clearTimeout(timeoutId)
        }

        if (!response.ok) {
            await incrementCounter("neynar.http_error")
            const error = await response.text()
            throw new Error(`Neynar API error: ${response.status} - ${error}`)
        }

        const data = await response.json()
        ok = true
        await incrementCounter("neynar.ok")
        return data as T
    } finally {
        await recordLatency("neynar.fetch", Date.now() - startMs, ok)
    }
}

/**
 * Fetch user data by username
 */
export async function fetchUserByUsername(username: string) {
    try {
        const data = await neynarFetch<{ user: NeynarUser }>(
            `/user/by_username?username=${encodeURIComponent(username)}`
        )
        
        return {
            success: true,
            data: {
                fid: data.user.fid,
                name: data.user.display_name,
                username: data.user.username,
                description: data.user.profile?.bio?.text || "",
                imageUrl: data.user.pfp_url,
                followerCount: data.user.follower_count,
                followingCount: data.user.following_count,
                warpcastUrl: `https://warpcast.com/${data.user.username}`,
                powerBadge: data.user.power_badge,
                neynarScore: data.user.experimental?.neynar_user_score || null,
                verifications: data.user.verifications
            }
        }
    } catch (error) {
        console.error("Neynar fetchUserByUsername error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch user" }
    }
}

/**
 * Fetch user data by FID
 */
export async function fetchUserByFid(fid: number) {
    try {
        const data = await neynarFetch<{ users: NeynarUser[] }>(
            `/user/bulk?fids=${fid}`
        )
        
        if (!data.users || data.users.length === 0) {
            return { error: "User not found" }
        }

        const user = data.users[0]
        return {
            success: true,
            data: {
                fid: user.fid,
                name: user.display_name,
                username: user.username,
                description: user.profile?.bio?.text || "",
                imageUrl: user.pfp_url,
                followerCount: user.follower_count,
                followingCount: user.following_count,
                warpcastUrl: `https://warpcast.com/${user.username}`,
                powerBadge: user.power_badge,
                neynarScore: user.experimental?.neynar_user_score || null,
                verifications: user.verifications
            }
        }
    } catch (error) {
        console.error("Neynar fetchUserByFid error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch user" }
    }
}

/**
 * Fetch channel data by channel ID
 */
export async function fetchChannelById(channelId: string) {
    try {
        const data = await neynarFetch<{ channel: NeynarChannel }>(
            `/channel?id=${encodeURIComponent(channelId)}`
        )

        const url = normalizeChannelUrl(data.channel.id, data.channel.url ?? "")
        
        return {
            success: true,
            data: {
                id: data.channel.id,
                name: data.channel.name,
                description: data.channel.description,
                imageUrl: data.channel.image_url,
                followerCount: data.channel.follower_count,
                warpcastUrl: url,
                url,
                lead: data.channel.lead ? {
                    fid: data.channel.lead.fid,
                    username: data.channel.lead.username,
                    displayName: data.channel.lead.display_name,
                    pfpUrl: data.channel.lead.pfp_url
                } : null
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch channel"
        if (message.includes("404") && message.includes("Channel with id")) {
            return { error: message }
        }
        console.error("Neynar fetchChannelById error:", error)
        return { error: message }
    }
}

/**
 * Fetch multiple users by FIDs (bulk)
 */
export async function fetchUsersBulk(fids: number[]) {
    try {
        const data = await neynarFetch<{ users: NeynarUser[] }>(
            `/user/bulk?fids=${fids.join(",")}`
        )
        
        return {
            success: true,
            data: data.users.map(user => ({
                fid: user.fid,
                name: user.display_name,
                username: user.username,
                description: user.profile?.bio?.text || "",
                imageUrl: user.pfp_url,
                followerCount: user.follower_count,
                followingCount: user.following_count,
                warpcastUrl: `https://warpcast.com/${user.username}`,
                powerBadge: user.power_badge,
                neynarScore: user.experimental?.neynar_user_score || null,
                verifications: user.verifications
            }))
        }
    } catch (error) {
        console.error("Neynar fetchUsersBulk error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch users" }
    }
}

/**
 * Search channels by query
 */
export async function searchChannels(query: string) {
    try {
        const data = await neynarFetch<{ channels: NeynarChannel[] }>(
            `/channel/search?q=${encodeURIComponent(query)}`
        )
        
        return {
            success: true,
            data: data.channels.map(channel => ({
                id: channel.id,
                name: channel.name,
                description: channel.description,
                imageUrl: channel.image_url,
                followerCount: channel.follower_count,
                warpcastUrl: channel.url
            }))
        }
    } catch (error) {
        console.error("Neynar searchChannels error:", error)
        return { error: error instanceof Error ? error.message : "Failed to search channels" }
    }
}

interface NeynarEmbed {
    url?: string
    metadata?: {
        content_type?: string
        image?: {
            width_px?: number
            height_px?: number
        }
    }
    cast_id?: {
        fid: number
        hash: string
    }
    cast?: {
        text?: string
        author?: {
            username: string
            display_name: string
            pfp_url: string
        }
    }
}

interface NeynarCast {
    hash: string
    text: string
    timestamp: string
    author: {
        fid: number
        username: string
        display_name: string
        pfp_url: string
    }
    reactions: {
        likes_count: number
        recasts_count: number
    }
    replies: {
        count: number
    }
    embeds?: NeynarEmbed[]
}

/**
 * Fetch recent casts from a channel (all users in channel)
 */
export async function fetchChannelCasts(channelId: string, limit: number = 5) {
    try {
        const data = await neynarFetch<{ casts: NeynarCast[] }>(
            `/feed/channels?channel_ids=${encodeURIComponent(channelId)}&limit=${limit}`
        )
        
        return {
            success: true,
            data: data.casts.map(cast => ({
                hash: cast.hash,
                text: cast.text,
                timestamp: cast.timestamp,
                author: {
                    fid: cast.author.fid,
                    username: cast.author.username,
                    displayName: cast.author.display_name,
                    pfpUrl: cast.author.pfp_url
                },
                likes: cast.reactions.likes_count,
                recasts: cast.reactions.recasts_count,
                replies: cast.replies.count,
                embeds: (cast.embeds || []).map(embed => ({
                    url: embed.url,
                    isImage: embed.metadata?.content_type?.startsWith('image/') || false,
                    width: embed.metadata?.image?.width_px,
                    height: embed.metadata?.image?.height_px,
                    quotedCast: embed.cast ? {
                        text: embed.cast.text,
                        author: embed.cast.author ? {
                            username: embed.cast.author.username,
                            displayName: embed.cast.author.display_name,
                            pfpUrl: embed.cast.author.pfp_url
                        } : null
                    } : null
                }))
            }))
        }
    } catch (error) {
        console.error("Neynar fetchChannelCasts error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch casts" }
    }
}

/**
 * Fetch recent casts from a specific user by FID (only their casts)
 */
export async function fetchCastsByFid(fid: number, limit: number = 5) {
    try {
        const data = await neynarFetch<{ casts: NeynarCast[] }>(
            `/feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=${limit}`
        )
        
        return {
            success: true,
            data: data.casts.map(cast => ({
                hash: cast.hash,
                text: cast.text,
                timestamp: cast.timestamp,
                author: {
                    fid: cast.author.fid,
                    username: cast.author.username,
                    displayName: cast.author.display_name,
                    pfpUrl: cast.author.pfp_url
                },
                likes: cast.reactions.likes_count,
                recasts: cast.reactions.recasts_count,
                replies: cast.replies.count,
                embeds: (cast.embeds || []).map(embed => ({
                    url: embed.url,
                    isImage: embed.metadata?.content_type?.startsWith('image/') || false,
                    width: embed.metadata?.image?.width_px,
                    height: embed.metadata?.image?.height_px,
                    quotedCast: embed.cast ? {
                        text: embed.cast.text,
                        author: embed.cast.author ? {
                            username: embed.cast.author.username,
                            displayName: embed.cast.author.display_name,
                            pfpUrl: embed.cast.author.pfp_url
                        } : null
                    } : null
                }))
            }))
        }
    } catch (error) {
        console.error("Neynar fetchCastsByFid error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch user casts" }
    }
}

/**
 * Fetch recent casts from a user
 */
export async function fetchUserCasts(fid: number, limit: number = 5) {
    try {
        const data = await neynarFetch<{ casts: NeynarCast[] }>(
            `/feed/user/${fid}/casts?limit=${limit}`
        )
        
        return {
            success: true,
            data: data.casts.map(cast => ({
                hash: cast.hash,
                text: cast.text,
                timestamp: cast.timestamp,
                author: {
                    fid: cast.author.fid,
                    username: cast.author.username,
                    displayName: cast.author.display_name,
                    pfpUrl: cast.author.pfp_url
                },
                likes: cast.reactions.likes_count,
                recasts: cast.reactions.recasts_count,
                replies: cast.replies.count,
                embeds: cast.embeds || []
            }))
        }
    } catch (error) {
        console.error("Neynar fetchUserCasts error:", error)
        return { error: error instanceof Error ? error.message : "Failed to fetch user casts" }
    }
}
