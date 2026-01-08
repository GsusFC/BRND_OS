import dotenv from "dotenv"
import path from "path"
import { PrismaClient } from "@prisma/client"

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
  const dbUrl = process.env.MYSQL_DATABASE_URL_WRITE ?? process.env.MYSQL_DATABASE_URL
  if (!dbUrl) {
    throw new Error("MYSQL_DATABASE_URL is not defined")
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

  try {
    const existing = await prisma.category.findMany({
      where: { name: { in: CANONICAL_CATEGORY_NAMES } },
      select: { name: true },
    })

    const present = new Set(existing.map((c) => c.name))
    const missing = CANONICAL_CATEGORY_NAMES.filter((name) => !present.has(name))

    if (missing.length === 0) {
      process.stdout.write("Canonical categories already present.\n")
      return
    }

    try {
      await prisma.category.createMany({
        data: missing.map((name) => ({ name })),
        skipDuplicates: true,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("INSERT command denied") && msg.includes("categories")) {
        throw new Error(
          "MySQL user has no INSERT permission on table 'categories'. Use a DB URL with write privileges (set MYSQL_DATABASE_URL_WRITE) or grant INSERT on categories."
        )
      }
      throw e
    }

    process.stdout.write(`Inserted canonical categories: ${missing.join(", ")}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
