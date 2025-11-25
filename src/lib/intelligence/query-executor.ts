import prisma from "@/lib/prisma";
import { isQuerySafe, sanitizeSQL } from "./sql-validator";

export async function executeQuery(sql: string): Promise<{
    success: boolean;
    data?: any[];
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
        const results = await prisma.$queryRawUnsafe(cleanSQL);

        return {
            success: true,
            data: results as any[]
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || "Query execution failed"
        };
    }
}
