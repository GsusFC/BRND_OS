import prismaIndexer from "@/lib/prisma-indexer"
import { isQuerySafe, sanitizeSQL, enforceLimits } from "./sql-validator"
import { formatErrorResponse } from "./error-translator"

const INDEXER_DISABLED = process.env.INDEXER_DISABLED === "true"
const QUERY_TIMEOUT_MS = 30_000 // 30 seconds

export interface QueryResult {
    success: boolean
    data?: unknown[]
    error?: string
    errorDetails?: {
        suggestion: string
        code: string
    }
    executionTimeMs?: number
}

/**
 * Execute a validated SQL query with timeout and limits
 */
export async function executeQuery(sql: string): Promise<QueryResult> {
    if (INDEXER_DISABLED) {
        return {
            success: false,
            error: "Indexer disabled for this environment.",
        }
    }

    // Validate query safety
    const validation = isQuerySafe(sql)
    if (!validation.safe) {
        return {
            success: false,
            error: validation.reason || "Query is not safe"
        }
    }

    try {
        // Sanitize, enforce limits, and execute
        const cleanSQL = sanitizeSQL(sql)
        const limitedSQL = enforceLimits(cleanSQL)

        const startTime = Date.now()

        // Execute with timeout
        const results = await executeWithTimeout(limitedSQL, QUERY_TIMEOUT_MS)

        const executionTimeMs = Date.now() - startTime

        return {
            success: true,
            data: results as unknown[],
            executionTimeMs
        }
    } catch (error: unknown) {
        const rawError = error instanceof Error ? error.message : "Query execution failed"
        const { error: friendlyError, errorDetails } = formatErrorResponse(rawError)

        return {
            success: false,
            error: friendlyError,
            errorDetails
        }
    }
}

/**
 * Execute query with timeout protection
 */
async function executeWithTimeout(sql: string, timeoutMs: number): Promise<unknown> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Query timeout")), timeoutMs)
    })

    const queryPromise = prismaIndexer.$queryRawUnsafe(sql)

    return Promise.race([queryPromise, timeoutPromise])
}
