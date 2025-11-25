import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const categories = [
        { name: 'DeFi', description: 'Decentralized Finance protocols and apps' },
        { name: 'NFT', description: 'Non-Fungible Token projects and marketplaces' },
        { name: 'Infrastructure', description: 'Blockchain infrastructure and tooling' },
        { name: 'Social', description: 'Social media and community platforms' },
        { name: 'Gaming', description: 'Blockchain-based games and metaverses' },
        { name: 'DAO', description: 'Decentralized Autonomous Organizations' },
        { name: 'Wallet', description: 'Crypto wallets and asset management' },
        { name: 'L2', description: 'Layer 2 scaling solutions' },
        { name: 'Other', description: 'Other categories' },
    ]

    console.log('Start seeding categories...')

    for (const category of categories) {
        const existing = await prisma.category.findFirst({
            where: { name: category.name }
        })
        if (!existing) {
            const cat = await prisma.category.create({ data: category })
            console.log(`Created category: ${cat.name}`)
        } else {
            console.log(`Category already exists: ${existing.name}`)
        }
    }

    console.log('Seeding finished.')
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
