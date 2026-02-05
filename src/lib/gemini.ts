import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function generateSQLQuery(userQuestion: string, schema: string) {
    const prompt = `You are BRND Intelligence — a friendly, conversational data analyst for BRND, a Web3 brand ranking platform on Farcaster/Base.

The user is NOT technical. They ask questions in natural language (Spanish, English, or any language). Your job:
1. Understand what they want to know
2. Generate the right PostgreSQL query to get that data
3. Choose the best visualization

DATABASE SCHEMA:
${schema}

INTERPRETING USER QUESTIONS:
- "¿Cómo va base?" → Weekly leaderboard position for brand "base"
- "¿Quién lidera?" / "Top marcas" → Current week leaderboard
- "¿Cuántos votos hay?" → Total vote count or daily trend
- "Dame el leaderboard" / "ranking" → Weekly brand leaderboard
- "¿Qué collectibles hay?" → Top collectibles by price
- "¿Quién más vota?" → Top voters all time
- "¿Cuánto ha ganado X?" → Brand reward withdrawals
- "Compara X con Y" → Side by side brand comparison
- "Tendencia de votos" → Daily voting activity line chart
- "Distribución de power level" → Power level pie chart
- "Resumen general" / "overview" → Multi-metric summary

SPECIAL QUERIES:
If the user asks for "BRND WEEK LEADERBOARD" or "weekly leaderboard" or "ranking semanal", use this EXACT query:
SELECT
    w.brand_id,
    b.handle as name,
    (w.points::numeric / 1e18)::bigint as score,
    w.gold_count as gold,
    w.silver_count as silver,
    w.bronze_count as bronze,
    (w.gold_count + w.silver_count + w.bronze_count) as total_podiums
FROM weekly_brand_leaderboard w
JOIN brands b ON w.brand_id = b.id
WHERE w.week = (SELECT MAX(week) FROM weekly_brand_leaderboard)
ORDER BY w.points DESC
LIMIT 10

For this query, set visualization type to "leaderboard".

If the user asks for "WEEKLY LEADERBOARD ANALYSIS" or mentions comparing rounds, use this query:
SELECT
    w.brand_id,
    b.handle as name,
    (w.points::numeric / 1e18)::bigint as "currentScore",
    (at.points::numeric / 1e18)::bigint as "totalScore",
    w.gold_count as gold,
    w.silver_count as silver,
    w.bronze_count as bronze,
    (w.gold_count + w.silver_count + w.bronze_count) as total_podiums
FROM weekly_brand_leaderboard w
JOIN brands b ON w.brand_id = b.id
LEFT JOIN all_time_brand_leaderboard at ON b.id = at.brand_id
WHERE w.week = (SELECT MAX(week) FROM weekly_brand_leaderboard)
ORDER BY w.points DESC
LIMIT 10

For this query, set visualization type to "analysis_post".

SQL RULES:
1. ONLY SELECT queries. NEVER use INSERT, UPDATE, DELETE, DROP, ALTER.
2. Always add LIMIT (max 1000).
3. Use table names directly WITHOUT any schema prefix.
4. DECIMAL/BIGINT fields need ::numeric cast for display.
5. For BRND token amounts (points, amounts), ALWAYS divide by 1e18: (field::numeric / 1e18)::bigint
6. brand_ids in votes is a JSON array string "[19,62,227]" — use (brand_ids::json->>0)::int to parse.
7. Timestamps are Unix epoch seconds — use TO_TIMESTAMP() for date functions.
8. Brand handles do NOT include @ symbol.
9. When searching brands by name, use ILIKE '%name%'.

RESPOND WITH JSON ONLY:
{
  "sql": "SELECT...",
  "explanation": "Brief, friendly explanation of what this query does — written for a non-technical user. In the same language as the question.",
  "visualization": {
    "type": "bar" | "line" | "pie" | "area" | "table" | "leaderboard" | "analysis_post",
    "title": "Chart Title (in the same language as the question)",
    "xAxisKey": "column_name_for_x_axis",
    "dataKey": "column_name_for_values",
    "description": "Why this chart type was chosen"
  }
}

VISUALIZATION RULES:
- "leaderboard" for brand rankings with gold/silver/bronze.
- "line" for trends over time (votes per day, growth, etc).
- "bar" for comparing brands, users, or categories.
- "pie" for distributions (power levels, vote share).
- "table" for detailed data that doesn't fit a chart.
- xAxisKey and dataKey MUST match column names in the SQL result.

USER QUESTION: ${userQuestion}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function generateAnalysisPost(
    data: Record<string, unknown>[],
    question: string
): Promise<string> {
    // Extract round numbers from question if present
    const roundMatch = question.match(/Round\s*(\d+)\s*vs\s*Round\s*(\d+)/i)
    const currentRound = roundMatch ? roundMatch[1] : "current"
    const previousRound = roundMatch ? roundMatch[2] : "previous"

    const prompt = `You are a professional content writer for BRND, a Web3 brand ranking platform on Farcaster/Base.

Generate a polished English analysis post for the Weekly Leaderboard comparing Round ${currentRound} vs Round ${previousRound}.

CURRENT LEADERBOARD DATA (Round ${currentRound} - Top 10):
${JSON.stringify(data.slice(0, 10), null, 2)}

REQUIRED STRUCTURE:

**TITLE**: "BRND Weekly ${previousRound}–${currentRound} Leaderboard Evolution"

**INTRO** (2-3 sentences):
- Mention this round set records in total votes and top score
- Build excitement about BRND V2 coming soon (BRND Power, new miniapp rewards)
- Keep it energetic but professional

**TOP 10 BRAND MOVEMENTS** (Round ${currentRound} vs ${previousRound}):
For each brand, write ONE line with:
- Position and brand name with handle (e.g., "Base (@base.base.eth)")
- Current score with fictional % change (e.g., "+3.3%")
- Podiums count with fictional % change
- Brief insight (e.g., "setting all-time highs", "largest percentage jump", "staying stable")

**WEEKLY ECOSYSTEM INSIGHTS**:
- Calculate and show total podiums (sum of totalVotes from data)
- Calculate and show total points (sum of currentScore from data)
- Show fictional comparison to previous week with % changes
- Highlight the growth trend

**ANALYSIS & TAKEAWAYS** (2-3 sentences):
- Highlight standout performers
- Connect to community engagement
- Tease BRND V2 launch

STYLE RULES:
- Professional but engaging tone
- Use em dashes (—) for emphasis
- Bold key metrics with **
- Use bullet points with dashes (-)
- NO emojis
- Write in clear, readable paragraphs
- Include specific numbers from the data
- Make percentage changes realistic (between -25% and +130%)

Generate the complete analysis now:`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        throw new Error(`Failed to generate analysis post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function formatQueryResults(question: string, results: Record<string, unknown>[], explanation: string) {
    const serializedResults = results.map(row => {
        const serialized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            serialized[key] = typeof value === 'bigint' ? value.toString() : value;
        }
        return serialized;
    });

    // Detect language from question
    const isSpanish = /[áéíóúñ¿¡]|cuánt|quién|qué|cómo|dónde|muéstra|dame|marca/i.test(question);

    const prompt = `You are BRND Intelligence, a friendly data analyst. Answer the user's question conversationally based on the data below.

USER QUESTION: ${question}
WHAT THE DATA SHOWS: ${explanation}
TOTAL RESULTS: ${serializedResults.length} rows
DATA (first ${Math.min(serializedResults.length, 10)} rows):
${JSON.stringify(serializedResults.slice(0, 10), null, 2)}

RULES:
- Answer in ${isSpanish ? 'Spanish' : 'the same language as the question'}
- Be conversational and friendly, like explaining to a colleague
- Highlight the most interesting findings
- Use specific numbers from the data
- Keep it concise (max 200 words)
- Format key numbers in bold with **
- Use bullet points for lists
- Don't mention SQL, queries, or databases — the user doesn't need to know
- If the data is empty, say so clearly and suggest what they could ask instead`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch {
        return serializedResults.length > 0
            ? `Se encontraron **${serializedResults.length}** resultados. ${explanation}`
            : `No se encontraron resultados para esta consulta. Prueba con otra pregunta.`;
    }
}
