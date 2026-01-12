const FARCASTER_HOST = "farcaster.xyz"
const FARCASTER_HOST_ALIASES = new Set(["warpcast.com", "farcaster.com", "farcaster.xyz"])

export const normalizeFarcasterUrl = (value?: string | null): string | null => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null

    let candidate = trimmed
    if (!candidate.startsWith("http")) {
        if (
            candidate.startsWith("warpcast.com/") ||
            candidate.startsWith("www.warpcast.com/") ||
            candidate.startsWith("farcaster.xyz/") ||
            candidate.startsWith("www.farcaster.xyz/") ||
            candidate.startsWith("farcaster.com/") ||
            candidate.startsWith("www.farcaster.com/")
        ) {
            candidate = `https://${candidate.replace(/^www\./, "")}`
        }
    }

    try {
        const parsed = new URL(candidate)
        const hostname = parsed.hostname.replace(/^www\./, "")
        if (FARCASTER_HOST_ALIASES.has(hostname)) {
            parsed.hostname = FARCASTER_HOST
        }
        return parsed.toString()
    } catch {
        return trimmed
    }
}
