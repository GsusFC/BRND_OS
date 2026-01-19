export const withConnectionLimit = (databaseUrl: string, limit = 1): string => {
    try {
        const url = new URL(databaseUrl)
        if (!url.searchParams.has("connection_limit")) {
            url.searchParams.set("connection_limit", String(limit))
        }
        return url.toString()
    } catch {
        return databaseUrl
    }
}
