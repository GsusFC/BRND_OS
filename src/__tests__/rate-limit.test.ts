import assert from "node:assert/strict"
import { test } from "node:test"
import { createRateLimiter } from "../lib/rate-limit"

type MemoryStore = {
    counts: Map<string, number>
    incrCalls: string[]
    expireCalls: Array<{ key: string; seconds: number }>
}

const createStore = (): MemoryStore & {
    incr: (key: string) => Promise<number>
    expire: (key: string, seconds: number) => Promise<number>
} => {
    const store: MemoryStore = {
        counts: new Map(),
        incrCalls: [],
        expireCalls: [],
    }

    return {
        ...store,
        incr: async (key: string) => {
            store.incrCalls.push(key)
            const next = (store.counts.get(key) ?? 0) + 1
            store.counts.set(key, next)
            return next
        },
        expire: async (key: string, seconds: number) => {
            store.expireCalls.push({ key, seconds })
            return 1
        },
    }
}

test("rate limiter allows requests within window", async () => {
    const nowRef = { value: 0 }
    const store = createStore()
    const limiter = createRateLimiter(store, {
        keyPrefix: "test:limit",
        windowSeconds: 60,
        maxRequests: 3,
        now: () => nowRef.value,
    })

    const first = await limiter("user-1")
    const second = await limiter("user-1")
    const third = await limiter("user-1")
    const fourth = await limiter("user-1")

    assert.equal(first, true)
    assert.equal(second, true)
    assert.equal(third, true)
    assert.equal(fourth, false)
    assert.equal(store.counts.size, 1)
    assert.equal(store.incrCalls.length, 4)
    assert.equal(store.expireCalls.length, 1)
    assert.equal(store.expireCalls[0]?.seconds, 60)

    const key = store.expireCalls[0]?.key ?? ""
    assert.ok(key.startsWith("test:limit:user-1:"))
    assert.ok(key.endsWith(":0"))
})

test("rate limiter resets on new window", async () => {
    const nowRef = { value: 0 }
    const store = createStore()
    const limiter = createRateLimiter(store, {
        keyPrefix: "test:limit",
        windowSeconds: 60,
        maxRequests: 1,
        now: () => nowRef.value,
    })

    const firstWindow = await limiter("user-2")
    nowRef.value = 61_000
    const secondWindow = await limiter("user-2")
    const secondWindowBlocked = await limiter("user-2")

    assert.equal(firstWindow, true)
    assert.equal(secondWindow, true)
    assert.equal(secondWindowBlocked, false)
    assert.equal(store.counts.size, 2)

    const keys = Array.from(store.counts.keys())
    assert.ok(keys.some((item) => item.endsWith(":0")))
    assert.ok(keys.some((item) => item.endsWith(":1")))
})

test("rate limiter isolates identifiers", async () => {
    const store = createStore()
    const limiter = createRateLimiter(store, {
        keyPrefix: "test:limit",
        windowSeconds: 30,
        maxRequests: 1,
    })

    const userAFirst = await limiter("user-a")
    const userASecond = await limiter("user-a")
    const userBFirst = await limiter("user-b")

    assert.equal(userAFirst, true)
    assert.equal(userASecond, false)
    assert.equal(userBFirst, true)
    assert.equal(store.counts.size, 2)
})
