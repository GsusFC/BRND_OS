import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/auth";
import { getAdminUser } from "@/lib/auth/admin-user-server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { generateSQLQuery, formatQueryResults, generateAnalysisPost, generateQuerySuggestions } from "@/lib/gemini";
import { executeQuery } from "@/lib/intelligence/query-executor";
import { DATABASE_SCHEMA } from "@/lib/intelligence/schema";
import { isQuerySafe } from "@/lib/intelligence/sql-validator";
import { createRateLimiter } from "@/lib/rate-limit";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands";

const rateLimiter = createRateLimiter(redis, {
    keyPrefix: "brnd:ratelimit:intelligence",
    windowSeconds: 60,
    maxRequests: 12,
});

interface CachedQueryResult {
    sql: string;
    explanation: string;
    visualization: unknown;
    data: Record<string, unknown>[];
    summary: string;
    suggestions?: string[];
    rowCount: number;
    executionTimeMs?: number;
    cachedAt: string;
}

/**
 * Generate cache key from question hash
 */
function getQueryCacheKey(question: string): string {
    const hash = createHash("sha256")
        .update(question.toLowerCase().trim())
        .digest("hex")
        .slice(0, 16);
    return CACHE_KEYS.intelligenceQuery(hash);
}

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

        const { question, skipCache } = await request.json();

        if (!question || typeof question !== "string" || question.trim().length === 0) {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }

        // Check server-side cache first (unless explicitly skipped)
        const cacheKey = getQueryCacheKey(question);

        if (!skipCache) {
            try {
                const cached = await redis.get<CachedQueryResult>(cacheKey);
                if (cached) {
                    return NextResponse.json({
                        success: true,
                        ...cached,
                        fromCache: true
                    });
                }
            } catch (cacheError) {
                // Cache miss or error, continue with fresh query
                console.warn("[intelligence] Cache read error:", cacheError);
            }
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
                    errorDetails: result.errorDetails,
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

        // Step 3: Enrich brand data with images/names
        // Detects brand_id in any query result and adds imageUrl from MySQL/Redis/snapshot
        const visualizationType = queryData.visualization?.type;

        if (serializedData && serializedData.length > 0) {
            // Check for brand_id in any casing (brand_id, Brand_id, etc.)
            const firstRow = serializedData[0];
            const brandIdKey = Object.keys(firstRow).find(k => k.toLowerCase() === "brand_id");

            if (brandIdKey) {
                const brandIds = serializedData
                    .map(row => Number(row[brandIdKey]))
                    .filter(id => Number.isFinite(id) && id > 0);

                if (brandIds.length > 0) {
                    try {
                        const metadata = await getBrandsMetadata(brandIds);
                        for (const row of serializedData) {
                            const brandId = Number(row[brandIdKey]);
                            const meta = metadata.get(brandId);
                            if (meta) {
                                row.imageUrl = meta.imageUrl;
                                if (!row.name && meta.name) row.name = meta.name;
                            }
                        }
                    } catch (e) {
                        console.warn("[intelligence] Failed to enrich brand metadata:", e);
                    }
                }
            }
        }

        // Step 4: Format results based on visualization type
        let summary: string;

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

        // Step 5: Generate follow-up suggestions (non-blocking)
        let suggestions: string[] = [];
        try {
            if (serializedData && serializedData.length > 0) {
                suggestions = await generateQuerySuggestions(
                    question,
                    serializedData,
                    queryData.explanation
                );
            }
        } catch (e) {
            console.warn("[intelligence] Failed to generate suggestions:", e);
        }

        const responseData: CachedQueryResult = {
            sql: queryData.sql,
            explanation: queryData.explanation,
            visualization: queryData.visualization,
            data: serializedData || [],
            summary,
            suggestions,
            rowCount: serializedData?.length || 0,
            executionTimeMs: result.executionTimeMs,
            cachedAt: new Date().toISOString()
        };

        // Cache the result
        try {
            await redis.setex(cacheKey, CACHE_TTL.intelligenceQuery, responseData);
        } catch (cacheError) {
            console.warn("[intelligence] Cache write error:", cacheError);
        }

        return NextResponse.json({
            success: true,
            ...responseData,
            fromCache: false
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
