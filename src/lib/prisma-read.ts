import "dotenv/config"
import { PrismaClient } from '@prisma/client'

const prismaRead = new PrismaClient({
    datasources: {
        db: {
            url: process.env.READONLY_DATABASE_URL,
        },
    },
})

declare global {
    var prismaReadGlobal: undefined | typeof prismaRead
}

const prisma = globalThis.prismaReadGlobal ?? prismaRead

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaReadGlobal = prisma
