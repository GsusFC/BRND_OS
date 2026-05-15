import assert from "node:assert/strict"
import { test } from "node:test"
import {
    normalizeChannelInput,
    normalizeProfileInput,
    toCanonicalHandle,
} from "../lib/farcaster/normalize-identifiers"

type BrandFieldSources = {
    turso?: Partial<BrandDisplayFields> | null
    ipfs?: Partial<BrandDisplayFields> | null
    indexer?: Partial<BrandDisplayFields> | null
    mysql?: Partial<Pick<BrandDisplayFields, "description" | "category">> | null
}

type BrandDisplayFields = {
    name: string
    imageUrl: string | null
    channel: string | null
    profile: string | null
    description: string | null
    category: string | null
}

const resolveDisplayFields = ({ turso, ipfs, indexer, mysql }: BrandFieldSources): BrandDisplayFields => ({
    // Invariant: detail-page display identity prefers Turso, then IPFS, then indexer fallback.
    name: turso?.name ?? ipfs?.name ?? indexer?.name ?? "Brand #1",
    imageUrl: turso?.imageUrl ?? ipfs?.imageUrl ?? indexer?.imageUrl ?? null,
    channel: turso?.channel ?? ipfs?.channel ?? indexer?.channel ?? null,
    profile: turso?.profile ?? ipfs?.profile ?? null,
    description: turso?.description ?? ipfs?.description ?? mysql?.description ?? null,
    category: turso?.category ?? ipfs?.category ?? mysql?.category ?? null,
})

const canonicalFallbackKey = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase()

test("canonicalization is deterministic for equivalent profile and channel inputs", () => {
    assert.equal(normalizeProfileInput(" @Base.eth?utm=1 "), "base.eth")
    assert.equal(normalizeProfileInput("https://warpcast.com/dwr.eth/0x123"), "dwr.eth")
    assert.equal(normalizeChannelInput("https://warpcast.com/~/channel/base"), "base")
    assert.equal(normalizeChannelInput("/Base?tab=casts"), "base")
    assert.equal(toCanonicalHandle({ queryType: "1", value: "@Alice" }), "alice")
    assert.equal(toCanonicalHandle({ queryType: "0", value: "/builders" }), "builders")
})

test("profile normalization rejects channel-only or ambiguous profile inputs", () => {
    assert.throws(() => normalizeProfileInput("https://warpcast.com/~/channel/base"), /Invalid Farcaster profile/)
    assert.throws(() => normalizeProfileInput("name_with_underscore"), /Invalid Farcaster profile/)
})

test("fallback precedence remains stable across Turso, IPFS, indexer, and MySQL fields", () => {
    const resolved = resolveDisplayFields({
        turso: {
            name: "Turso Name",
            imageUrl: "https://turso.example/image.png",
            channel: "/turso",
            description: "Turso description",
        },
        ipfs: {
            name: "IPFS Name",
            imageUrl: "https://ipfs.example/image.png",
            channel: "/ipfs",
            profile: "ipfs-profile",
            description: "IPFS description",
            category: "IPFS Category",
        },
        indexer: {
            name: "Indexer Handle",
            imageUrl: "https://indexer.example/image.png",
            channel: "/indexer",
        },
        mysql: {
            description: "MySQL description",
            category: "MySQL Category",
        },
    })

    assert.deepEqual(resolved, {
        name: "Turso Name",
        imageUrl: "https://turso.example/image.png",
        channel: "/turso",
        profile: "ipfs-profile",
        description: "Turso description",
        category: "IPFS Category",
    })
})

test("fallback text identities must be unique before they can be treated as merge candidates", () => {
    const candidates = [
        { id: 1, name: "Brand.Name", channel: "/brand-name", profile: "" },
        { id: 2, name: "Brand Name", channel: "/brandname", profile: "" },
    ]

    const candidateKeys = new Map<string, Set<number>>()
    for (const candidate of candidates) {
        for (const value of [candidate.name, candidate.channel, candidate.profile]) {
            if (!value) continue
            const key = canonicalFallbackKey(value)
            const ids = candidateKeys.get(key) ?? new Set<number>()
            ids.add(candidate.id)
            candidateKeys.set(key, ids)
        }
    }

    // Invariant: punctuation-stripped textual fallback can collapse distinct brands.
    // A production sync must not auto-merge when a canonical fallback key maps to multiple ids.
    assert.deepEqual(Array.from(candidateKeys.get("brandname") ?? []), [1, 2])
})
