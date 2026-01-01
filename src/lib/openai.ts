import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSQLQuery(userQuestion: string, schema: string) {
    const prompt = `You are an expert SQL analyst for BRND, a brand voting platform.

DATABASE SCHEMA:
${schema}

RULES:
1. ONLY generate SELECT queries (never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE)
2. Use descriptive aliases
3. Limit results to 1000 rows maximum
4. Use JOINs when necessary
5. Format dates in readable format
6. Use MySQL syntax

USER QUESTION: ${userQuestion}

RESPOND IN JSON FORMAT:
{
  "sql": "SELECT...",
  "explanation": "This query retrieves...",
  "suggestedVisualization": "table|chart|number"
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert SQL analyst. Always respond with valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No response from OpenAI");

        return JSON.parse(content);
    } catch (error: unknown) {
        console.error("OpenAI API error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to generate SQL: ${errorMessage}`);
    }
}

export async function formatQueryResults(
    question: string,
    results: Record<string, unknown>[],
    explanation: string
) {
    const prompt = `You are a data analyst presenting results to a marketing team.

ORIGINAL QUESTION: ${question}

QUERY EXPLANATION: ${explanation}

RESULTS (${results.length} rows):
${JSON.stringify(results.slice(0, 10), null, 2)}
${results.length > 10 ? `\n... and ${results.length - 10} more rows` : ''}

Generate a concise, friendly summary of these results in Spanish.
Include key insights and numbers.
Keep it under 200 words.`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a friendly data analyst. Respond in Spanish."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        return completion.choices[0].message.content || `Se encontraron ${results.length} resultados. ${explanation}`;
    } catch (error: unknown) {
        console.error("OpenAI API error:", error);
        return `Se encontraron ${results.length} resultados. ${explanation}`;
    }
}
