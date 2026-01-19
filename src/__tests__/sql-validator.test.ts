import assert from "node:assert/strict"
import { test } from "node:test"
import { isQuerySafe, sanitizeSQL } from "../lib/intelligence/sql-validator"

test("rejects forbidden keywords", () => {
    const result = isQuerySafe("DROP TABLE users")

    assert.equal(result.safe, false)
    assert.ok(result.reason?.includes("DROP"))
    assert.ok(result.reason?.toUpperCase().includes("DROP"))
})

test("rejects multiple statements", () => {
    const result = isQuerySafe("SELECT 1; SELECT 2")

    assert.equal(result.safe, false)
    assert.equal(result.reason, "Multiple statements not allowed")
})

test("allows create temporary table", () => {
    const result = isQuerySafe("CREATE TEMPORARY TABLE temp (id INT)")

    assert.equal(result.safe, true)
    assert.equal(result.reason, undefined)
})

test("rejects create table", () => {
    const result = isQuerySafe("CREATE TABLE users (id INT)")

    assert.equal(result.safe, false)
    assert.equal(
        result.reason,
        "Only CREATE TEMPORARY TABLE is allowed, not permanent tables."
    )
})

test("sanitizeSQL trims and removes trailing semicolon", () => {
    const sanitized = sanitizeSQL("  SELECT * FROM users; ")

    assert.equal(sanitized, "SELECT * FROM users")
    assert.ok(!sanitized.endsWith(";"))
    assert.equal(sanitized.startsWith("SELECT"), true)
})
