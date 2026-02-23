import assert from "node:assert/strict"
import { test } from "node:test"
import { firstGuardianFid, normalizeGuardianFid } from "../lib/guardian/guardian-fid"

test("normalizeGuardianFid returns positive integer only", () => {
    assert.equal(normalizeGuardianFid(123), 123)
    assert.equal(normalizeGuardianFid("456"), 456)
    assert.equal(normalizeGuardianFid("0"), null)
    assert.equal(normalizeGuardianFid(-1), null)
    assert.equal(normalizeGuardianFid("abc"), null)
    assert.equal(normalizeGuardianFid(undefined), null)
})

test("firstGuardianFid returns the first valid candidate", () => {
    assert.equal(firstGuardianFid(null, "0", "22", 33), 22)
    assert.equal(firstGuardianFid(undefined, null, -5), null)
    assert.equal(firstGuardianFid("7", 8), 7)
})

