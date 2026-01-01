/**
 * Genera snapshot de brands metadata
 * Ejecutar: node scripts/generate-brands-snapshot.cjs
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config()
const mysql = require("mysql2/promise")
const fs = require("fs")
const path = require("path")

const OUTPUT_FILE = path.join(process.cwd(), "public/data/brands.json")

async function main() {
  console.log("🚀 Generating brands snapshot...")

  let dbUrl = process.env.MYSQL_DATABASE_URL || ""
  dbUrl = dbUrl.replace(/[?&]ssl-mode=[^&]*/gi, "")

  const conn = await mysql.createConnection({
    uri: dbUrl,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const [brands] = await conn.query(
      `SELECT id, name, imageUrl, channel FROM brands WHERE banned = 0`
    )

    const brandsMap = {}
    for (const b of brands) {
      brandsMap[b.id] = {
        name: b.name,
        imageUrl: b.imageUrl,
        channel: b.channel
      }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(brandsMap, null, 2))
    console.log(`✅ Saved ${Object.keys(brandsMap).length} brands to ${OUTPUT_FILE}`)
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error("❌ Error:", e.message)
  process.exit(1)
})
