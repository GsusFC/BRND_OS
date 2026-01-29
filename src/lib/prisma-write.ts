import { PrismaClient } from '@prisma/client'
import { withConnectionLimit } from "@/lib/prisma-utils"

const prismaWriteClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: process.env.TURSO_DATABASE_URL
                    ? withConnectionLimit(process.env.TURSO_DATABASE_URL)
                    : undefined,
            },
        },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'query'] : ['error'],
    })
}

declare global {
    var prismaWriteGlobal: undefined | ReturnType<typeof prismaWriteClientSingleton>
}

const prismaWrite = globalThis.prismaWriteGlobal ?? prismaWriteClientSingleton()

export default prismaWrite

globalThis.prismaWriteGlobal = prismaWrite
