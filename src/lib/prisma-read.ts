import "dotenv/config"
import { PrismaClient } from '@prisma/client'
import { withConnectionLimit } from "@/lib/prisma-utils"

const prismaRead = new PrismaClient({
    datasources: {
        db: {
            url: process.env.READONLY_DATABASE_URL
                ? withConnectionLimit(process.env.READONLY_DATABASE_URL)
                : undefined,
        },
    },
})

declare global {
    var prismaReadGlobal: undefined | typeof prismaRead
}

const prisma = globalThis.prismaReadGlobal ?? prismaRead

export default prisma

globalThis.prismaReadGlobal = prisma
