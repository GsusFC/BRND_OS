import assert from "node:assert/strict"
import { test } from "node:test"

async function withEnv<T>(values: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
    const previous = new Map<string, string | undefined>()

    for (const [key, value] of Object.entries(values)) {
        previous.set(key, process.env[key])
        if (value === undefined) {
            delete process.env[key]
        } else {
            process.env[key] = value
        }
    }

    try {
        return await run()
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key]
            } else {
                process.env[key] = value
            }
        }
    }
}

test("Turso client fails loudly when critical credentials are missing", async () => {
    // Invariant: Turso-backed write/read paths must not silently run with an undefined database target.
    await withEnv({ TURSO_DATABASE_URL: undefined, TURSO_AUTH_TOKEN: undefined }, async () => {
        const { default: turso } = await import("../lib/turso")

        assert.throws(() => turso.execute("SELECT 1"), /TURSO_DATABASE_URL is not defined/)
    })
})

test("Turso client fails loudly when auth token is missing", async () => {
    // Invariant: a database URL without a token is still an invalid production-critical configuration.
    await withEnv({ TURSO_DATABASE_URL: "libsql://example.turso.io", TURSO_AUTH_TOKEN: undefined }, async () => {
        const { default: turso } = await import("../lib/turso")

        assert.throws(() => turso.execute("SELECT 1"), /TURSO_AUTH_TOKEN is not defined/)
    })
})

test("Redis cache helper degrades to fallback when Upstash credentials are unavailable", async () => {
    // Invariant: Redis is a cache layer; missing credentials should not block read paths with fallback functions.
    await withEnv({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }, async () => {
        const originalError = console.error
        console.error = () => {}
        const { getWithFallback } = await import("../lib/redis")

        try {
            const result = await getWithFallback("invariant:test", async () => "fallback-value")

            assert.equal(result, "fallback-value")
        } finally {
            console.error = originalError
        }
    })
})

test("indexer defaults to disabled stub outside production unless explicitly enabled", async () => {
    // Invariant: local/test execution should degrade intentionally instead of requiring a live indexer database.
    await withEnv(
        {
            NODE_ENV: "test",
            INDEXER_DISABLED: undefined,
            INDEXER_DATABASE_URL: undefined,
        },
        async () => {
            const { default: prismaIndexer } = await import("../lib/prisma-indexer")

            assert.deepEqual(await prismaIndexer.$queryRawUnsafe("SELECT 1"), [])
            assert.equal(await prismaIndexer.indexerBrand.count(), 0)
        }
    )
})
