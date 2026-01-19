import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminUser } from "@/lib/auth/admin-user-server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { generateSQLQuery, formatQueryResults, generateAnalysisPost } from "@/lib/gemini";
import { executeQuery } from "@/lib/intelligence/query-executor";
import { DATABASE_SCHEMA } from "@/lib/intelligence/schema";
import { isQuerySafe } from "@/lib/intelligence/sql-validator";
import { createRateLimiter } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";

const rateLimiter = createRateLimiter(redis, {
    keyPrefix: "brnd:ratelimit:intelligence",
    windowSeconds: 60,
    maxRequests: 12,
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const sessionUser = session?.user as { fid?: number; role?: string } | undefined;

        if (!sessionUser || typeof sessionUser.fid !== "number") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let canQuery = sessionUser.role === "admin";
        if (!canQuery) {
            const adminUser = await getAdminUser(sessionUser.fid);
            canQuery = hasPermission(adminUser, PERMISSIONS.INTELLIGENCE);
        }

        if (!canQuery) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const allowed = await rateLimiter(sessionUser.fid);
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const { question } = await request.json();

        if (!question || typeof question !== "string" || question.trim().length === 0) {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }

        // Step 1: Generate SQL from natural language
        const queryData = await generateSQLQuery(question, DATABASE_SCHEMA);

        if (!queryData?.sql || typeof queryData.sql !== "string") {
            return NextResponse.json({ error: "Invalid SQL generated" }, { status: 500 });
        }

        const validation = isQuerySafe(queryData.sql);
        if (!validation.safe) {
            return NextResponse.json(
                { error: validation.reason || "Query is not safe" },
                { status: 400 }
            );
        }

        // Step 2: Execute the query
        const result = await executeQuery(queryData.sql);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error,
                    sql: queryData.sql,
                    explanation: queryData.explanation
                },
                { status: 400 }
            );
        }

        // Convert BigInt to string for JSON serialization
        const serializedData = result.data?.map(row => {
            const serialized: Record<string, unknown> = {};
            if (row && typeof row === 'object') {
                for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
                    serialized[key] = typeof value === 'bigint' ? value.toString() : value;
                }
            }
            return serialized;
        });

        // Step 3: Format results based on visualization type
        let summary: string;
        const visualizationType = queryData.visualization?.type;
        
        if (visualizationType === "leaderboard" && serializedData && serializedData.length > 0) {
            // Fast path: generate summary without AI call
            const top3 = serializedData.slice(0, 3);
            summary = `Top 3 del BRND Week Leaderboard:\n1. ${top3[0]?.name || 'N/A'} (${top3[0]?.score || 0} pts)\n2. ${top3[1]?.name || 'N/A'} (${top3[1]?.score || 0} pts)\n3. ${top3[2]?.name || 'N/A'} (${top3[2]?.score || 0} pts)`;
        } else if (visualizationType === "analysis_post" && serializedData && serializedData.length > 0) {
            // Generate social media analysis post
            summary = await generateAnalysisPost(serializedData, question);
        } else {
            summary = await formatQueryResults(
                question,
                serializedData || [],
                queryData.explanation
            );
        }

        return NextResponse.json({
            success: true,
            sql: queryData.sql,
            explanation: queryData.explanation,
            visualization: queryData.visualization,
            data: serializedData,
            summary,
            rowCount: serializedData?.length || 0
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("Intelligence API error:", errorMessage);
        
        // Check if it's a Gemini API error
        if (errorMessage.includes("API key") || errorMessage.includes("quota") || errorMessage.includes("model")) {
            return NextResponse.json(
                { error: `AI Service Error: ${errorMessage}` },
                { status: 503 }
            );
        }
        
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
