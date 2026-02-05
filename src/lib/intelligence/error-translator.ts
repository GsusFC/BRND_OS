/**
 * Translate database/query errors to user-friendly messages
 */

interface TranslatedError {
    message: string
    suggestion?: string
    code?: string
}

const ERROR_PATTERNS: Array<{
    pattern: RegExp
    translate: (match: RegExpMatchArray) => TranslatedError
}> = [
    // Column doesn't exist
    {
        pattern: /column "?([^"]+)"? does not exist/i,
        translate: (match) => ({
            message: `The field "${match[1]}" doesn't exist in the database.`,
            suggestion: `Check the schema for available fields. Common fields: id, fid, brand_id, points, timestamp.`,
            code: "COLUMN_NOT_FOUND"
        })
    },
    // Table doesn't exist
    {
        pattern: /relation "?([^"]+)"? does not exist/i,
        translate: (match) => ({
            message: `The table "${match[1]}" doesn't exist.`,
            suggestion: `Available tables: users, brands, votes, weekly_brand_leaderboard, podium_collectibles.`,
            code: "TABLE_NOT_FOUND"
        })
    },
    // Syntax error
    {
        pattern: /syntax error at or near "([^"]+)"/i,
        translate: (match) => ({
            message: `SQL syntax error near "${match[1]}".`,
            suggestion: `Try rephrasing your question more clearly.`,
            code: "SYNTAX_ERROR"
        })
    },
    // Division by zero
    {
        pattern: /division by zero/i,
        translate: () => ({
            message: `Cannot divide by zero.`,
            suggestion: `Add a filter to exclude zero values: WHERE column > 0`,
            code: "DIVISION_BY_ZERO"
        })
    },
    // Invalid input syntax for type
    {
        pattern: /invalid input syntax for (?:type )?(\w+): "([^"]+)"/i,
        translate: (match) => ({
            message: `Invalid value "${match[2]}" for type ${match[1]}.`,
            suggestion: `Check that you're comparing the right types (e.g., numbers vs text).`,
            code: "TYPE_MISMATCH"
        })
    },
    // Aggregate function error
    {
        pattern: /aggregate functions are not allowed in WHERE/i,
        translate: () => ({
            message: `Cannot use SUM, COUNT, AVG in WHERE clause.`,
            suggestion: `Use HAVING for filtering aggregates: GROUP BY ... HAVING COUNT(*) > 5`,
            code: "AGGREGATE_IN_WHERE"
        })
    },
    // Group by error
    {
        pattern: /must appear in the GROUP BY clause/i,
        translate: () => ({
            message: `Missing GROUP BY clause for aggregate query.`,
            suggestion: `Add all non-aggregated columns to GROUP BY.`,
            code: "MISSING_GROUP_BY"
        })
    },
    // Ambiguous column
    {
        pattern: /column reference "([^"]+)" is ambiguous/i,
        translate: (match) => ({
            message: `Column "${match[1]}" exists in multiple tables.`,
            suggestion: `Specify the table: table_name.${match[1]}`,
            code: "AMBIGUOUS_COLUMN"
        })
    },
    // Connection errors
    {
        pattern: /connection (refused|timed out|reset)/i,
        translate: () => ({
            message: `Database connection failed.`,
            suggestion: `Please try again in a few moments.`,
            code: "CONNECTION_ERROR"
        })
    },
    // Timeout
    {
        pattern: /Query timed out/i,
        translate: () => ({
            message: `Query took too long to execute.`,
            suggestion: `Try adding filters (WHERE), reducing date range, or limiting results.`,
            code: "TIMEOUT"
        })
    },
    // Too many results
    {
        pattern: /result set too large/i,
        translate: () => ({
            message: `Query returned too many results.`,
            suggestion: `Add LIMIT or filter with WHERE to reduce results.`,
            code: "TOO_MANY_RESULTS"
        })
    },
    // Permission denied
    {
        pattern: /permission denied/i,
        translate: () => ({
            message: `Access denied to this data.`,
            suggestion: `Contact an admin if you need access.`,
            code: "PERMISSION_DENIED"
        })
    },
    // Numeric overflow
    {
        pattern: /numeric field overflow/i,
        translate: () => ({
            message: `Number too large for calculation.`,
            suggestion: `Try using ::numeric cast or filtering large values.`,
            code: "NUMERIC_OVERFLOW"
        })
    },
    // JSON parsing error
    {
        pattern: /invalid input syntax for type json/i,
        translate: () => ({
            message: `Invalid JSON format in data.`,
            suggestion: `The brand_ids field should be parsed as JSON array.`,
            code: "JSON_PARSE_ERROR"
        })
    },
]

/**
 * Translate a raw database error to a user-friendly message
 */
export function translateError(rawError: string): TranslatedError {
    // Check each pattern
    for (const { pattern, translate } of ERROR_PATTERNS) {
        const match = rawError.match(pattern)
        if (match) {
            return translate(match)
        }
    }

    // Default fallback
    return {
        message: "Query execution failed.",
        suggestion: "Try rephrasing your question or check the query syntax.",
        code: "UNKNOWN_ERROR"
    }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(rawError: string): {
    error: string
    errorDetails?: {
        suggestion: string
        code: string
    }
} {
    const translated = translateError(rawError)

    return {
        error: translated.message,
        errorDetails: translated.suggestion ? {
            suggestion: translated.suggestion,
            code: translated.code || "UNKNOWN"
        } : undefined
    }
}
