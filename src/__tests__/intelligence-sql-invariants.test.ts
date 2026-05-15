import assert from "node:assert/strict"
import { test } from "node:test"
import { enforceLimits, isQuerySafe, sanitizeSQL } from "../lib/intelligence/sql-validator"

test("dangerous SQL mutation and privilege patterns are rejected", () => {
    // Invariant: intelligence SQL remains read-oriented except for the explicit temporary-table carve-out.
    for (const sql of [
        "INSERT INTO brands(id) VALUES (1)",
        "UPDATE brands SET name = 'x'",
        "DELETE FROM brands",
        "DROP TABLE brands",
        "ALTER TABLE brands ADD COLUMN x int",
        "TRUNCATE brands",
        "GRANT SELECT ON brands TO public",
        "REVOKE SELECT ON brands FROM public",
        "CALL refresh_scores()",
        "EXECUTE refresh_scores",
    ]) {
        const result = isQuerySafe(sql)
        assert.equal(result.safe, false, sql)
        assert.ok(result.reason, sql)
    }
})

test("allowed SELECT, WITH, and compound read patterns remain valid", () => {
    // Invariant: SQL safety checks should block writes without breaking supported read analysis.
    for (const sql of [
        "SELECT id, name FROM brands WHERE id = 1",
        "WITH ranked AS (SELECT id FROM brands) SELECT * FROM ranked",
        "SELECT id FROM brands UNION SELECT id FROM brands_archive",
    ]) {
        assert.equal(isQuerySafe(sql).safe, true, sql)
    }
})

test("CREATE TEMPORARY TABLE behavior is explicit and permanent CREATE TABLE remains blocked", () => {
    // Invariant: current implementation allows temporary materialization only, not permanent DDL.
    const temporary = isQuerySafe("CREATE TEMPORARY TABLE temp_brand_scores AS SELECT id FROM brands")
    const permanent = isQuerySafe("CREATE TABLE brand_scores AS SELECT id FROM brands")

    assert.equal(temporary.safe, true)
    assert.equal(permanent.safe, false)
    assert.equal(permanent.reason, "Only CREATE TEMPORARY TABLE is allowed, not permanent tables.")
})

test("query sanitization and limit enforcement keep bounded read behavior stable", () => {
    // Invariant: intelligence reads are capped unless a stricter LIMIT is already present.
    assert.equal(sanitizeSQL("  SELECT * FROM brands; "), "SELECT * FROM brands")
    assert.equal(enforceLimits("SELECT * FROM brands"), "SELECT * FROM brands LIMIT 500")
    assert.equal(enforceLimits("SELECT * FROM brands LIMIT 50"), "SELECT * FROM brands LIMIT 50")
    assert.equal(enforceLimits("SELECT * FROM brands LIMIT 5000"), "SELECT * FROM brands LIMIT 1000")
    assert.equal(enforceLimits("SELECT * FROM brands OFFSET 20"), "SELECT * FROM brands LIMIT 500 OFFSET 20")
})
