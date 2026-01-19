type HeadersLike = {
    get: (name: string) => string | null
}

export const getClientIpFromHeaders = (headers: HeadersLike): string | null => {
    const forwardedFor = headers.get("x-forwarded-for")
    if (forwardedFor) {
        const [first] = forwardedFor.split(",")
        if (first) return first.trim()
    }

    const realIp = headers.get("x-real-ip")
    if (realIp) return realIp.trim()

    return null
}

export const getRequestOrigin = (headers: HeadersLike): string | null => {
    const originHeader = headers.get("origin")
    if (originHeader) {
        try {
            return new URL(originHeader).host
        } catch {
            return originHeader.trim()
        }
    }

    const host = headers.get("x-forwarded-host") ?? headers.get("host")
    return host ? host.trim() : null
}
