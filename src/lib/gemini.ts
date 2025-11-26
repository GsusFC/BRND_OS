import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function generateSQLQuery(userQuestion: string, schema: string) {
    const prompt = `You are an expert SQL analyst for BRND.

DATABASE SCHEMA:
${schema}

IMPORTANT CONTEXT:
- Brand names in the database do NOT include @ symbol (e.g., "floc" not "@floc")
- When searching for brands, use LIKE '%brandname%' to be flexible
- Current date is ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${new Date().toISOString().split('T')[0]})
- Date fields use DATETIME format
- For "this month", use: date >= '${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01'

TABLE RELATIONSHIPS & PURPOSE:
1. users: Stores profile data (fid, username, points). Linked to votes via userId.
2. brands: Stores brand info (name, categoryId). Linked to votes via brand1Id, brand2Id, brand3Id.
3. categories: Links to brands via categoryId.
4. user_brand_votes: The core voting table. 
   - userId -> users.id
   - brand1Id, brand2Id, brand3Id -> brands.id (Top 3 choices)
   - date: When the vote happened.
5. user_daily_actions: Tracks bonus actions like sharing.

COMMON PATTERNS:
- To find votes for a brand, check brand1Id OR brand2Id OR brand3Id.
- To count total votes for a brand: COUNT(CASE WHEN brand1Id=b.id THEN 1 END) + ...
- To find user activity: JOIN user_brand_votes on users.id = userId.

SPECIAL QUERIES:
If the user asks for "BRND WEEK LEADERBOARD" or "weekly leaderboard", use this EXACT query:
SELECT 
    b.name,
    b.imageUrl,
    b.channel,
    b.scoreWeek as score,
    COUNT(CASE WHEN v.brand1Id = b.id THEN 1 END) as gold,
    COUNT(CASE WHEN v.brand2Id = b.id THEN 1 END) as silver,
    COUNT(CASE WHEN v.brand3Id = b.id THEN 1 END) as bronze,
    COUNT(CASE WHEN v.brand1Id = b.id OR v.brand2Id = b.id OR v.brand3Id = b.id THEN 1 END) as totalVotes
FROM brands b
LEFT JOIN user_brand_votes v ON (v.brand1Id = b.id OR v.brand2Id = b.id OR v.brand3Id = b.id)
    AND v.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
WHERE b.banned = 0
GROUP BY b.id, b.name, b.imageUrl, b.channel, b.scoreWeek
ORDER BY b.scoreWeek DESC
LIMIT 10

For this query, set visualization type to "leaderboard" (special type).

If the user asks for "WEEKLY LEADERBOARD ANALYSIS" or mentions comparing rounds (e.g., "Round 23 vs Round 22"), use this query to get comprehensive data:
SELECT 
    b.name,
    b.channel,
    b.scoreWeek as currentScore,
    b.score as totalScore,
    COUNT(CASE WHEN v.brand1Id = b.id THEN 1 END) as gold,
    COUNT(CASE WHEN v.brand2Id = b.id THEN 1 END) as silver,
    COUNT(CASE WHEN v.brand3Id = b.id THEN 1 END) as bronze,
    COUNT(CASE WHEN v.brand1Id = b.id OR v.brand2Id = b.id OR v.brand3Id = b.id THEN 1 END) as totalVotes
FROM brands b
LEFT JOIN user_brand_votes v ON (v.brand1Id = b.id OR v.brand2Id = b.id OR v.brand3Id = b.id)
    AND v.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
WHERE b.banned = 0
GROUP BY b.id, b.name, b.channel, b.scoreWeek, b.score
ORDER BY b.scoreWeek DESC
LIMIT 10

For this query, set visualization type to "analysis_post" (special type for generating social media posts).

RULES:
1. PRIORITIZE simple SELECT queries. Only use CREATE TEMPORARY TABLE for very complex multi-step calculations.
2. NEVER use: INSERT, UPDATE, DELETE, DROP, ALTER (permanent tables)
3. Always add LIMIT 1000
4. Use MySQL syntax
5. When joining user_brand_votes with brands, remember a brand can be in brand1Id, brand2Id, OR brand3Id

RESPOND WITH JSON ONLY:
{
  "sql": "SELECT...",
  "explanation": "Brief explanation...",
  "visualization": {
    "type": "bar" | "line" | "pie" | "area" | "table" | "leaderboard",
    "title": "Chart Title",
    "xAxisKey": "column_name_for_x_axis",
    "dataKey": "column_name_for_values",
    "description": "Why this chart was chosen"
  }
}

VISUALIZATION RULES:
- Use "line" for trends over time (dates, months).
- Use "bar" for comparing categories, brands, or users.
- Use "pie" for parts of a whole (percentages).
- Use "table" if data is just a list or doesn't fit a chart.
- xAxisKey MUST match a column name in the SQL result.
- dataKey MUST match a numerical column name in the SQL result.

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

    const prompt = `Summarize these SQL results in Spanish(max 200 words):

    QUESTION: ${question}
    EXPLANATION: ${explanation}
    RESULTS: ${serializedResults.length} rows
${JSON.stringify(serializedResults.slice(0, 5), null, 2)} `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch {
        return `Se encontraron ${serializedResults.length} resultados.${explanation} `;
    }
}
