export type RateLimitStore = {
    incr: (key: string) => Promise<number>
    expire: (key: string, seconds: number) => Promise<number | boolean>
}

type RateLimiterOptions = {
    keyPrefix: string
    windowSeconds: number
    maxRequests: number
    now?: () => number
}

export const createRateLimiter = (store: RateLimitStore, options: RateLimiterOptions) => {
    return async (identifier: string | number): Promise<boolean> => {
        const now = options.now ? options.now() : Date.now()
        const nowSeconds = Math.floor(now / 1000)
        const windowKey = Math.floor(nowSeconds / options.windowSeconds)
        const key = `${options.keyPrefix}:${identifier}:${windowKey}`

        const count = await store.incr(key)
        if (count === 1) {
            await store.expire(key, options.windowSeconds)
        }

        return count <= options.maxRequests
    }
}
