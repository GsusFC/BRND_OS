import { PrismaClient } from '@prisma/client'
import { withConnectionLimit } from "@/lib/prisma-utils"

if (!process.env.MYSQL_DATABASE_URL) {
    throw new Error('MYSQL_DATABASE_URL is not defined')
}

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: withConnectionLimit(process.env.MYSQL_DATABASE_URL),
            },
        },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
