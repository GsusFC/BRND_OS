import prismaRead from "./src/lib/prisma-read"
import prismaWrite from "./src/lib/prisma-write"

async function main() {
    console.log("🔄 Syncing categories from Read‑Only DB to Write DB...")

    // 1️⃣ Fetch all categories from the read‑only (DigitalOcean) database
    const categories = await prismaRead.category.findMany()
    console.log(`Found ${categories.length} categories in Read‑Only DB.`)

    // 2️⃣ Insert each category into the write (SQLite) DB with a "(New)" suffix
    for (const category of categories) {
        const newName = `${category.name} (New)`

        // Avoid duplicates (by original ID)
        const existing = await prismaWrite.category.findFirst({
            where: { id: category.id },
        })

        if (!existing) {
            await prismaWrite.category.create({
                data: {
                    id: category.id, // keep original ID for consistency
                    name: newName,
                    createdAt: category.createdAt,
                    updatedAt: category.updatedAt,
                },
            })
            console.log(`✅ Created category: ${newName} (ID: ${category.id})`)
        } else {
            console.log(`⚠️ Category already exists: ${existing.name} (ID: ${existing.id})`)
        }
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
