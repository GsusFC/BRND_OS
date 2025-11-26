import { NextRequest, NextResponse } from "next/server";
import { generateSQLQuery, formatQueryResults } from "@/lib/gemini";
import { executeQuery } from "@/lib/intelligence/query-executor";
import { DATABASE_SCHEMA } from "@/lib/intelligence/schema";

export async function POST(request: NextRequest) {
    try {
        const { question } = await request.json();

        if (!question || typeof question !== "string") {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }

        // Step 1: Generate SQL from natural language
        const queryData = await generateSQLQuery(question, DATABASE_SCHEMA);

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

        // Step 3: Format results with AI
        const summary = await formatQueryResults(
            question,
            result.data || [],
            queryData.explanation
        );

        // Convert BigInt to string for JSON serialization
        const serializedData = result.data?.map(row => {
            const serialized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
                serialized[key] = typeof value === 'bigint' ? value.toString() : value;
            }
            return serialized;
        });

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
