import prismaRead from "../src/lib/prisma-read"
import prismaWrite from "../src/lib/prisma-write"
import { CANONICAL_CATEGORY_NAMES } from "../src/lib/brand-categories"

async function main() {
    console.log("🔄 Syncing categories from Read‑Only DB to Write DB...")

    // 1️⃣ Fetch all categories from the read‑only (DigitalOcean) database
    const categories = await prismaRead.category.findMany({
        where: { name: { in: Array.from(CANONICAL_CATEGORY_NAMES) } },
    })
    console.log(`Found ${categories.length} categories in Read‑Only DB.`)

    // 2️⃣ Upsert each category into the write (SQLite) DB to ensure exact consistency
    for (const category of categories) {
        // Data Integrity: Use exact name match, no suffixes
        const name = category.name

        // Use upsert to prevent drift (handle both Create and Update)
        await prismaWrite.category.upsert({
            where: { id: category.id },
            update: {
                name: name,
                // Do not overwrite createdAt if it exists, but sync updatedAt
                updatedAt: category.updatedAt,
            },
            create: {
                id: category.id,
                name: name,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            },
        })
        console.log(`✅ Synced category: ${name} (ID: ${category.id})`)
    }

    console.log("🎉 Sync complete!")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prismaRead.$disconnect()
        await prismaWrite.$disconnect()
    })
