type QueryTypeLike = "0" | "1" | 0 | 1

const USERNAME_REGEX = /^(?!-)[a-z0-9-]{1,16}(\.eth)?$/

const toUrl = (value: string): URL | null => {
    try {
        return new URL(value)
    } catch {
        return null
    }
}

const looksLikeFarcasterHost = (value: string): boolean => {
    const normalized = value.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase()
    return (
        normalized.startsWith("warpcast.com/") ||
        normalized.startsWith("farcaster.xyz/") ||
        normalized.startsWith("farcaster.com/")
    )
}

const buildUrlCandidate = (input: string): string => {
    if (input.startsWith("http://") || input.startsWith("https://")) return input
    if (looksLikeFarcasterHost(input)) {
        return `https://${input.replace(/^www\./, "")}`
    }
    return ""
}

export const normalizeProfileInput = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) {
        throw new Error("Profile is required and cannot be blank.")
    }

    let candidate = trimmed
    const parsed = toUrl(buildUrlCandidate(candidate))
    if (parsed) {
        const firstSegment = parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? ""
        if (!firstSegment || firstSegment === "~") {
            throw new Error("Invalid Farcaster profile input.")
        }
        candidate = firstSegment
    }

    candidate = candidate.replace(/^@+/, "")
    candidate = candidate.replace(/^\/+/, "")
    candidate = (candidate.split("?")[0] ?? "").split("#")[0]?.split("/")[0] ?? ""
    const normalized = candidate.trim().toLowerCase()

    if (!USERNAME_REGEX.test(normalized)) {
        throw new Error("Invalid Farcaster profile format.")
    }

    return normalized
}

export const normalizeChannelInput = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) {
        throw new Error("Channel is required and cannot be blank.")
    }

    let candidate = trimmed
    const parsed = toUrl(buildUrlCandidate(candidate))
    if (parsed) {
        const segments = parsed.pathname.split("/").filter(Boolean)
        let extracted = ""

        const channelIndex = segments.indexOf("channel")
        if (channelIndex >= 0) {
            extracted = segments[channelIndex + 1] ?? ""
        }

        if (!extracted) {
            const tildeIndex = segments.indexOf("~")
            if (tildeIndex >= 0 && segments[tildeIndex + 1] === "channel") {
                extracted = segments[tildeIndex + 2] ?? ""
            }
        }

        if (!extracted && segments.length > 0) {
            extracted = segments[0] ?? ""
        }

        candidate = extracted || candidate
    }

    candidate = candidate.replace(/^[@/]+/, "")
    candidate = candidate.replace(/^\/+/, "")
    candidate = (candidate.split("?")[0] ?? "").split("#")[0]?.split("/")[0] ?? ""
    const normalized = candidate.trim().toLowerCase()

    if (!normalized) {
        throw new Error("Invalid Farcaster channel format.")
    }

    return normalized
}

export const toCanonicalHandle = ({
    queryType,
    value,
}: {
    queryType: QueryTypeLike
    value: string
}): string => {
    if (queryType === "1" || queryType === 1) {
        return normalizeProfileInput(value)
    }
    return normalizeChannelInput(value)
}

