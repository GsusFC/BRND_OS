import { parse, type Statement } from "sql-parser-cst"

const MAX_RESULTS_LIMIT = 1000
const DEFAULT_LIMIT = 500

export interface ValidationResult {
    safe: boolean
    reason?: string
    normalized?: string
}

/**
 * Validates SQL query using AST parsing for security.
 * Only allows SELECT statements (with optional CTEs).
 */
export function isQuerySafe(sql: string): ValidationResult {
    const trimmed = sql.trim()

    // Empty query check
    if (!trimmed) {
        return { safe: false, reason: "Empty query" }
    }

    try {
        // Parse SQL into AST
        const ast = parse(trimmed, { dialect: "postgresql" })

        // Check for multiple statements
        if (ast.statements.length > 1) {
            return { safe: false, reason: "Multiple statements not allowed" }
        }

        if (ast.statements.length === 0) {
            return { safe: false, reason: "No valid SQL statement found" }
        }

        const stmt = ast.statements[0]

        // Only allow SELECT statements (with optional CTE)
        if (!isAllowedStatement(stmt, trimmed)) {
            return {
                safe: false,
                reason: getStatementRejectionReason(stmt)
            }
        }

        return { safe: true, normalized: trimmed }
    } catch {
        // If parsing fails, fall back to keyword-based validation
        // This handles edge cases where the parser might not support certain syntax
        return fallbackValidation(trimmed)
    }
}

/**
 * Check if statement is an allowed type (SELECT or CTE with SELECT)
 */
function isAllowedStatement(stmt: Statement, sql: string): boolean {
    const type = stmt.type

    // Direct SELECT
    if (type === "select_stmt") return true

    // WITH ... SELECT (Common Table Expression)
    if (type === "compound_select_stmt") {
        // Compound selects (UNION, INTERSECT, EXCEPT) are allowed
        return true
    }

    // Allow temporary tables for controlled intermediate analysis only.
    if (type === "create_table_stmt") {
        return /^CREATE\s+TEMPORARY\s+TABLE\b/i.test(sql)
    }

    return false
}

function getStatementRejectionReason(stmt: Statement): string {
    if (stmt.type === "create_table_stmt") {
        return "Only CREATE TEMPORARY TABLE is allowed, not permanent tables."
    }

    return `Only SELECT queries are allowed. Detected: ${getStatementType(stmt)}`
}

/**
 * Get human-readable statement type
 */
function getStatementType(stmt: Statement): string {
    const typeMap: Record<string, string> = {
        select_stmt: "SELECT",
        insert_stmt: "INSERT",
        update_stmt: "UPDATE",
        delete_stmt: "DELETE",
        create_table_stmt: "CREATE TABLE",
        drop_table_stmt: "DROP TABLE",
        alter_table_stmt: "ALTER TABLE",
        truncate_stmt: "TRUNCATE",
    }
    return typeMap[stmt.type] || stmt.type.replace(/_stmt$/, "").toUpperCase()
}

/**
 * Fallback validation using regex when AST parsing fails
 */
function fallbackValidation(sql: string): ValidationResult {
    const upperSQL = sql.toUpperCase()

    // Forbidden patterns
    const forbidden = [
        { pattern: /\b(INSERT\s+INTO)\b/i, name: "INSERT" },
        { pattern: /\b(UPDATE\s+\w+\s+SET)\b/i, name: "UPDATE" },
        { pattern: /\b(DELETE\s+FROM)\b/i, name: "DELETE" },
        { pattern: /\b(DROP\s+(TABLE|DATABASE|INDEX|VIEW))\b/i, name: "DROP" },
        { pattern: /\b(ALTER\s+(TABLE|DATABASE))\b/i, name: "ALTER" },
        { pattern: /\b(TRUNCATE)\b/i, name: "TRUNCATE" },
        { pattern: /\b(GRANT|REVOKE)\b/i, name: "GRANT/REVOKE" },
        { pattern: /\b(CREATE\s+(?!TEMPORARY))/i, name: "CREATE" },
        { pattern: /\b(EXEC|EXECUTE|CALL)\b/i, name: "EXECUTE" },
    ]

    for (const { pattern, name } of forbidden) {
        if (pattern.test(sql)) {
            return { safe: false, reason: `Forbidden operation: ${name}` }
        }
    }

    // Must start with SELECT, WITH, or CREATE TEMPORARY TABLE
    const startsWithAllowedPrefix =
        upperSQL.startsWith("SELECT") ||
        upperSQL.startsWith("WITH") ||
        /^CREATE\s+TEMPORARY\s+TABLE\b/i.test(sql)

    if (!startsWithAllowedPrefix) {
        return { safe: false, reason: "Query must start with SELECT, WITH, or CREATE TEMPORARY TABLE" }
    }

    // Check for statement terminators in the middle (potential injection)
    const semiColonCount = (sql.match(/;/g) || []).length
    if (semiColonCount > 1 || (semiColonCount === 1 && !sql.trim().endsWith(";"))) {
        return { safe: false, reason: "Multiple statements detected" }
    }

    return { safe: true }
}

/**
 * Sanitize and normalize SQL query
 */
export function sanitizeSQL(sql: string): string {
    return sql.trim().replace(/;$/, "")
}

/**
 * Enforce LIMIT on query to prevent returning too many rows.
 * If query has no LIMIT, adds default. If LIMIT exceeds max, caps it.
 */
export function enforceLimits(sql: string): string {
    const trimmed = sanitizeSQL(sql)

    // Check if query already has LIMIT
    const limitMatch = trimmed.match(/\bLIMIT\s+(\d+)/i)

    if (limitMatch) {
        const currentLimit = parseInt(limitMatch[1], 10)
        if (currentLimit > MAX_RESULTS_LIMIT) {
            // Cap the limit
            return trimmed.replace(
                /\bLIMIT\s+\d+/i,
                `LIMIT ${MAX_RESULTS_LIMIT}`
            )
        }
        return trimmed
    }

    // No LIMIT found, add default
    // Handle OFFSET without LIMIT edge case
    if (/\bOFFSET\s+\d+/i.test(trimmed)) {
        return trimmed.replace(
            /\bOFFSET\s+(\d+)/i,
            `LIMIT ${DEFAULT_LIMIT} OFFSET $1`
        )
    }

    return `${trimmed} LIMIT ${DEFAULT_LIMIT}`
}
