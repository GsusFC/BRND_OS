import prismaIndexer from "@/lib/prisma-indexer";
import { isQuerySafe, sanitizeSQL } from "./sql-validator";

export async function executeQuery(sql: string): Promise<{
    success: boolean;
    data?: unknown[];
    error?: string;
}> {
    // Validate query safety
    const validation = isQuerySafe(sql);
    if (!validation.safe) {
        return {
            success: false,
            error: validation.reason || "Query is not safe"
        };
    }

    try {
        // Sanitize and execute
        const cleanSQL = sanitizeSQL(sql);
        const results = await prismaIndexer.$queryRawUnsafe(cleanSQL);

        return {
            success: true,
            data: results as unknown[]
        };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Query execution failed"
        };
    }
}
