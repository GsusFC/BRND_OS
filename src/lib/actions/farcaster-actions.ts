"use server"

export async function fetchFarcasterData(queryType: string, value: string) {
    if (!value) return { error: "Please enter a value to fetch." }

    try {
        // 0 = Channel, 1 = Profile
        if (queryType === "0") {
            // Fetch Channel
            const response = await fetch(`https://api.warpcast.com/v1/channel?channelId=${value}`)
            const data = await response.json()

            if (!response.ok || !data.result) {
                return { error: "Channel not found on Warpcast." }
            }

            const channel = data.result.channel
            return {
                success: true,
                data: {
                    name: channel.name,
                    description: channel.description,
                    imageUrl: channel.imageUrl,
                    followerCount: channel.followerCount,
                    warpcastUrl: channel.url,
                    url: channel.url // Often channels don't have a separate website, defaulting to warpcast url
                }
            }

        } else {
            // Fetch Profile (User)
            const response = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${value}`)
            const data = await response.json()

            if (!response.ok || !data.result) {
                return { error: "User not found on Warpcast." }
            }

            const user = data.result.user
            return {
                success: true,
                data: {
                    name: user.displayName,
                    description: user.profile.bio.text,
                    imageUrl: user.pfp.url,
                    followerCount: user.followerCount,
                    warpcastUrl: `https://warpcast.com/${user.username}`,
                    url: null // Users might have a bio link, but it's not always in a standard field in this endpoint
                }
            }
        }
    } catch (error) {
        console.error("Farcaster Fetch Error:", error)
        return { error: "Failed to connect to Warpcast API." }
    }
}
