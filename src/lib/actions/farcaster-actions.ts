"use server"

import { fetchChannelByIdCached, fetchUserByUsernameCached } from "@/lib/farcaster-profile-cache"
import { normalizeChannelInput, normalizeProfileInput } from "@/lib/farcaster/normalize-identifiers"

/**
 * Public Server Action: Fetches public Farcaster data (User or Channel).
 * Security: Safe to be public as it wraps read-only calls to public APIs (Neynar) 
 * and cached data. No sensitive system data is exposed.
 * Used in the public ApplyForm.
 */
export async function fetchFarcasterData(queryType: string, value: string) {
    const trimmedValue = typeof value === "string" ? value.trim() : ""
    if (!trimmedValue) return { error: "Please enter a value to fetch." }
    if (queryType !== "0" && queryType !== "1") {
        return { error: "Invalid query type." }
    }

    try {
        // 0 = Channel, 1 = Profile
        if (queryType === "0") {
            const canonicalChannel = normalizeChannelInput(trimmedValue)
            // Fetch Channel via cache (Turso) + Neynar read-through
            const result = await fetchChannelByIdCached(canonicalChannel)
            
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
                    url: result.data.url,
                    canonicalChannel: `/${canonicalChannel}`,
                    canonicalHandle: canonicalChannel,
                }
            }

        } else {
            const canonicalProfile = normalizeProfileInput(trimmedValue)
            // Fetch Profile (User) via cache (Turso) + Neynar read-through
            const result = await fetchUserByUsernameCached(canonicalProfile)
            
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
                    fid: result.data.fid,
                    canonicalProfile,
                    canonicalHandle: canonicalProfile,
                }
            }
        }
    } catch (error) {
        console.error("Farcaster Fetch Error:", error)
        if (error instanceof Error && error.message) {
            return { error: error.message }
        }
        return { error: "Failed to connect to Neynar API." }
    }
}
