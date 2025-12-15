"use server"

import { fetchChannelByIdCached, fetchUserByUsernameCached } from "@/lib/farcaster-profile-cache"

export async function fetchFarcasterData(queryType: string, value: string) {
    if (!value) return { error: "Please enter a value to fetch." }

    try {
        // 0 = Channel, 1 = Profile
        if (queryType === "0") {
            // Fetch Channel via cache (Turso) + Neynar read-through
            const result = await fetchChannelByIdCached(value)
            
            if ('error' in result) {
                return { error: result.error }
            }

            return {
                success: true,
                data: {
                    name: result.data.name,
                    description: result.data.description,
                    imageUrl: result.data.imageUrl,
                    followerCount: result.data.followerCount,
                    warpcastUrl: result.data.warpcastUrl,
                    url: result.data.url
                }
            }

        } else {
            // Fetch Profile (User) via cache (Turso) + Neynar read-through
            const result = await fetchUserByUsernameCached(value)
            
            if ('error' in result) {
                return { error: result.error }
            }

            return {
                success: true,
                data: {
                    name: result.data.name,
                    description: result.data.description,
                    imageUrl: result.data.imageUrl,
                    followerCount: result.data.followerCount,
                    warpcastUrl: result.data.warpcastUrl,
                    url: null,
                    // Additional Neynar data
                    neynarScore: result.data.neynarScore,
                    powerBadge: result.data.powerBadge,
                    fid: result.data.fid
                }
            }
        }
    } catch (error) {
        console.error("Farcaster Fetch Error:", error)
        return { error: "Failed to connect to Neynar API." }
    }
}
