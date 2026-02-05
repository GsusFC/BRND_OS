/**
 * Sync Intelligence Schema
 *
 * This script generates the DATABASE_SCHEMA constant for the Intelligence module
 * by introspecting the Prisma indexer schema file.
 *
 * Run: npx tsx scripts/sync-intelligence-schema.ts
 */

import * as fs from "fs"
import * as path from "path"

const PRISMA_SCHEMA_PATH = path.join(process.cwd(), "prisma/schema.indexer.prisma")
const OUTPUT_PATH = path.join(process.cwd(), "src/lib/intelligence/schema.ts")

interface FieldInfo {
    name: string
    type: string
    dbType?: string
    isOptional: boolean
    isPrimary: boolean
    description?: string
}

interface ModelInfo {
    name: string
    tableName: string
    fields: FieldInfo[]
    description?: string
}

// Skip internal Ponder tables and reorg tables
const SKIP_PREFIXES = ["ponder_", "reorg__", "_ponder", "_reorg"]

// Manual descriptions for tables (can be extended)
const TABLE_DESCRIPTIONS: Record<string, string> = {
    users: "Stores all user information and voting data.",
    brands: "Stores information about all brands that users can vote on.",
    votes: "Records user voting sessions with brand choices.",
    wallet_authorizations: "Tracks wallets authorized by users for transactions.",
    reward_claims: "Records of BRND reward claims by users.",
    brand_reward_withdrawals: "Records of brand owners withdrawing their BRND rewards.",
    brnd_power_level_ups: "Records of users leveling up their BRND power.",
    all_time_user_leaderboard: "All-time user ranking by points.",
    daily_brand_leaderboard: "Daily brand rankings and medal counts.",
    weekly_brand_leaderboard: "Weekly brand rankings and medal counts.",
    monthly_brand_leaderboard: "Monthly brand rankings and medal counts.",
    all_time_brand_leaderboard: "All-time brand ranking by total points.",
    podium_collectibles: "NFT collectibles representing podium arrangements.",
    collectible_sales: "Sales history for podium collectible NFTs.",
    collectible_repeat_fees: "Repeat fee claims for collectible owners.",
    collectible_ownership_history: "Ownership transfer history for collectibles.",
}

// Manual field descriptions
const FIELD_DESCRIPTIONS: Record<string, Record<string, string>> = {
    users: {
        fid: "Farcaster ID (Primary Key)",
        brnd_power_level: "User's BRND power level (1-5)",
        total_votes: "Total number of votes cast",
        points: "User's current point balance (use ::numeric for display)",
        last_vote_day: "Last day user voted (day number since season start)",
    },
    brands: {
        id: "Brand ID (Primary Key)",
        fid: "Brand owner's Farcaster ID",
        handle: "Brand handle (NO @ symbol)",
        total_brnd_awarded: "Total BRND tokens awarded to brand",
        available_brnd: "Available BRND tokens for withdrawal",
    },
    votes: {
        brand_ids: 'JSON array of 3 brand IDs voted for (e.g., "[19,62,227]")',
        day: "Day number since season start",
        cost: "Cost of the vote in BRND tokens",
        timestamp: "Vote timestamp (Unix seconds)",
    },
    podium_collectibles: {
        token_id: "NFT token ID (Primary Key)",
        arrangement_hash: "Hash of brand arrangement (gold+silver+bronze)",
        gold_brand_id: "Brand ID in gold position",
        silver_brand_id: "Brand ID in silver position",
        bronze_brand_id: "Brand ID in bronze position",
        genesis_creator_fid: "FID of the user who first minted this arrangement",
        current_owner_fid: "FID of the current NFT owner",
        claim_count: "Number of times this NFT has been claimed/bought",
        current_price: "Current price in BRND tokens",
    },
}

function parsePrismaType(type: string, dbType?: string): string {
    const typeMap: Record<string, string> = {
        Int: "INT",
        String: "VARCHAR",
        Decimal: "DECIMAL(78,0)",
        Boolean: "BOOLEAN",
        DateTime: "TIMESTAMP",
        BigInt: "BIGINT",
        Float: "FLOAT",
        Json: "JSON",
    }

    let result = typeMap[type] || type.toUpperCase()

    // Override with DB-specific type if available
    if (dbType) {
        if (dbType.includes("Decimal")) result = "DECIMAL(78,0)"
        if (dbType.includes("VarChar")) result = "VARCHAR"
    }

    return result
}

function parseSchema(content: string): ModelInfo[] {
    const models: ModelInfo[] = []
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g

    let match
    while ((match = modelRegex.exec(content)) !== null) {
        const modelName = match[1]
        const modelBody = match[2]

        // Check for @@map to get actual table name
        const mapMatch = modelBody.match(/@@map\("([^"]+)"\)/)
        const tableName = mapMatch ? mapMatch[1] : modelName.toLowerCase()

        // Skip internal tables
        if (SKIP_PREFIXES.some(prefix => tableName.startsWith(prefix))) {
            continue
        }

        // Parse fields
        const fields: FieldInfo[] = []
        const lines = modelBody.split("\n")

        for (const line of lines) {
            const trimmed = line.trim()

            // Skip empty lines, directives, and @@map
            if (!trimmed || trimmed.startsWith("@@") || trimmed.startsWith("//")) {
                continue
            }

            // Parse field: name Type @modifiers
            const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?\s*(.*)$/)
            if (!fieldMatch) continue

            const [, fieldName, fieldType, optional, modifiers] = fieldMatch

            // Get @map name if present (actual column name)
            const mapFieldMatch = modifiers.match(/@map\("([^"]+)"\)/)
            const columnName = mapFieldMatch ? mapFieldMatch[1] : fieldName

            // Check for @db.Type
            const dbTypeMatch = modifiers.match(/@db\.(\w+)(?:\(([^)]+)\))?/)
            const dbType = dbTypeMatch ? dbTypeMatch[0] : undefined

            // Check for @id
            const isPrimary = modifiers.includes("@id")

            fields.push({
                name: columnName,
                type: parsePrismaType(fieldType, dbType),
                isOptional: !!optional,
                isPrimary,
                description: FIELD_DESCRIPTIONS[tableName]?.[columnName],
            })
        }

        if (fields.length > 0) {
            models.push({
                name: modelName,
                tableName,
                fields,
                description: TABLE_DESCRIPTIONS[tableName],
            })
        }
    }

    return models
}

function generateSchemaDoc(models: ModelInfo[]): string {
    const lines: string[] = [
        "export const DATABASE_SCHEMA = `",
        "# BRND Database Schema (PostgreSQL - Indexer)",
        "All tables use standard PostgreSQL naming. Use table names directly without schema prefix.",
        "",
        "## Core Tables",
        "",
    ]

    // Sort models: core tables first, then leaderboards, then collectibles
    const sortOrder = ["users", "brands", "votes", "wallet_authorizations"]
    const sortedModels = [...models].sort((a, b) => {
        const aIndex = sortOrder.indexOf(a.tableName)
        const bIndex = sortOrder.indexOf(b.tableName)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.tableName.localeCompare(b.tableName)
    })

    let currentSection = "core"
    for (const model of sortedModels) {
        // Add section headers
        if (model.tableName.includes("leaderboard") && currentSection !== "leaderboards") {
            lines.push("## Leaderboard Tables", "")
            currentSection = "leaderboards"
        } else if (model.tableName.includes("collectible") && currentSection !== "collectibles") {
            lines.push("## Collectible NFT Tables", "")
            currentSection = "collectibles"
        }

        lines.push(`### Table: ${model.tableName}`)

        if (model.description) {
            lines.push(model.description)
        }

        for (const field of model.fields) {
            let fieldLine = `- ${field.name}: ${field.type}`

            if (field.isPrimary) fieldLine += " (Primary Key)"
            if (field.isOptional) fieldLine += " (nullable)"
            if (field.description) fieldLine += ` - ${field.description}`

            lines.push(fieldLine)
        }

        lines.push("")
    }

    // Add query tips
    lines.push("## Query Tips")
    lines.push("")
    lines.push("### Time Handling")
    lines.push("- Timestamps are stored as Unix seconds (DECIMAL). Convert with: to_timestamp(timestamp)")
    lines.push("- Day numbers are relative to season start. Current day: EXTRACT(EPOCH FROM NOW())::bigint / 86400")
    lines.push("")
    lines.push("### Common Joins")
    lines.push("- votes.fid → users.fid (voter info)")
    lines.push("- votes.brand_ids → brands.id (voted brands, parse JSON array)")
    lines.push("- daily_brand_leaderboard.brand_id → brands.id")
    lines.push("- podium_collectibles.gold_brand_id/silver_brand_id/bronze_brand_id → brands.id")
    lines.push("")
    lines.push("### Numeric Display")
    lines.push("- For large decimals use: points::numeric or ROUND(points::numeric, 2)")
    lines.push("- Brand IDs from votes: Use json_array_elements_text(brand_ids::json)::int")
    lines.push("")
    lines.push("### Week Calculation")
    lines.push("- Week number: (day_number - 1) / 7 + 1")
    lines.push("- Current week in leaderboards: ORDER BY week DESC LIMIT 1")
    lines.push("`;")

    return lines.join("\n")
}

async function main() {
    console.log("Reading Prisma schema...")
    const schemaContent = fs.readFileSync(PRISMA_SCHEMA_PATH, "utf-8")

    console.log("Parsing models...")
    const models = parseSchema(schemaContent)
    console.log(`Found ${models.length} tables (excluding internal Ponder tables)`)

    console.log("Generating schema documentation...")
    const schemaDoc = generateSchemaDoc(models)

    console.log(`Writing to ${OUTPUT_PATH}...`)
    fs.writeFileSync(OUTPUT_PATH, schemaDoc)

    console.log("✅ Schema sync complete!")
    console.log("\nTables included:")
    for (const model of models) {
        console.log(`  - ${model.tableName} (${model.fields.length} columns)`)
    }
}

main().catch(console.error)
