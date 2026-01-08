import dotenv from "dotenv"
import path from "path"
import { createClient } from "@libsql/client"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config()

const CANONICAL_CATEGORY_NAMES = [
  "DeFi",
  "NFT",
  "Infrastructure",
  "Social",
  "Gaming",
  "DAO",
  "Wallet",
  "L2",
  "Other",
]

async function main() {
  const url = process.env.TURSO_DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not defined")
  }
  if (!token) {
    throw new Error("TURSO_AUTH_TOKEN is not defined")
  }

  const client = createClient({ url, authToken: token })

  const columnsResult = await client.execute("PRAGMA table_info(categories)")
  const columnNames = new Set(columnsResult.rows.map((r) => String(r.name)))

  const hasCreatedAt = columnNames.has("createdAt")
  const hasUpdatedAt = columnNames.has("updatedAt")

  for (const name of CANONICAL_CATEGORY_NAMES) {
    if (hasCreatedAt && hasUpdatedAt) {
      await client.execute({
        sql: `INSERT INTO categories (name, createdAt, updatedAt)
              SELECT ?, datetime('now'), datetime('now')
              WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)` ,
        args: [name, name],
      })
      continue
    }

    if (hasCreatedAt && !hasUpdatedAt) {
      await client.execute({
        sql: `INSERT INTO categories (name, createdAt)
              SELECT ?, datetime('now')
              WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)` ,
        args: [name, name],
      })
      continue
    }

    if (!hasCreatedAt && hasUpdatedAt) {
      await client.execute({
        sql: `INSERT INTO categories (name, updatedAt)
              SELECT ?, datetime('now')
              WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)` ,
        args: [name, name],
      })
      continue
    }

    await client.execute({
      sql: `INSERT INTO categories (name)
            SELECT ?
            WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)` ,
      args: [name, name],
    })
  }

  const verify = await client.execute({
    sql: `SELECT name FROM categories WHERE name IN (${CANONICAL_CATEGORY_NAMES.map(() => "?").join(", ")})`,
    args: CANONICAL_CATEGORY_NAMES,
  })

  const present = new Set(verify.rows.map((r) => String(r.name)))
  const missing = CANONICAL_CATEGORY_NAMES.filter((n) => !present.has(n))
  if (missing.length > 0) {
    throw new Error(`Failed to insert canonical categories: ${missing.join(", ")}`)
  }

  process.stdout.write("Canonical categories ensured in Turso.\n")
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
