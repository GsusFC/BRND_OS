import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const categories = [
        { name: 'DeFi' },
        { name: 'NFT' },
        { name: 'Infrastructure' },
        { name: 'Social' },
        { name: 'Gaming' },
        { name: 'DAO' },
        { name: 'Wallet' },
        { name: 'L2' },
        { name: 'Other' },
    ]

    console.log('🔄 Updating categories in production DB...')

    for (const category of categories) {
        const existing = await prisma.category.findFirst({
            where: { name: category.name }
        })
        if (!existing) {
            const cat = await prisma.category.create({ data: category })
            console.log(`✅ Created: ${cat.name}`)
        } else {
            console.log(`⏭️  Exists: ${existing.name}`)
        }
    }

    console.log('✨ Done!')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
