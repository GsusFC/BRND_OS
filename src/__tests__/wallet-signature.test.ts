import assert from "node:assert/strict"
import { test } from "node:test"
import { privateKeyToAccount } from "viem/accounts"
import {
    buildWalletNonceKey,
    buildWalletSignatureMessage,
    normalizeWalletAddress,
    verifyWalletSignature,
} from "../lib/wallet-signature"

test("buildWalletNonceKey uses normalized address", () => {
    const account = privateKeyToAccount(
        "0x1c0a9d1f6b3b7dcb2e4b8c38a5d55c0df3b226bfa2d3a5d90f0bd2ab4f5ed0c2",
    )
    const nonce = "nonce-123"
    const key = buildWalletNonceKey(account.address.toLowerCase(), nonce)
    const normalized = normalizeWalletAddress(account.address)

    assert.ok(key.includes(normalized))
    assert.ok(key.endsWith(`:${nonce}`))
})

test("verifyWalletSignature validates signatures", async () => {
    const account = privateKeyToAccount(
        "0x5b6f6c2f4f2e4a4b4b2c9b1a7e4d6f8b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f",
    )
    const nonce = "nonce-456"
    const expiresAt = 1_740_000_000_000
    const origin = "brnd.local"

    const message = buildWalletSignatureMessage({
        address: account.address,
        nonce,
        expiresAt,
        origin,
    })

    const signature = await account.signMessage({ message })

    const valid = await verifyWalletSignature({
        address: account.address,
        nonce,
        expiresAt,
        origin,
        signature,
    })

    const invalid = await verifyWalletSignature({
        address: account.address,
        nonce: "nonce-789",
        expiresAt,
        origin,
        signature,
    })

    assert.equal(valid, true)
    assert.equal(invalid, false)
})
