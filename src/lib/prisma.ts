import { PrismaClient } from '@prisma/client'
import { withConnectionLimit } from "@/lib/prisma-utils"

const MYSQL_DISABLED = process.env.MYSQL_DISABLED === "true"
const mysqlDatabaseUrl = process.env.MYSQL_DATABASE_URL
if (!mysqlDatabaseUrl && !MYSQL_DISABLED) {
    console.warn("[prisma] MYSQL_DATABASE_URL is not defined. Falling back to disabled datasource URL.")
}
const effectiveUrl = mysqlDatabaseUrl ?? "mysql://disabled:disabled@localhost:3306/disabled"

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: withConnectionLimit(effectiveUrl),
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

globalThis.prismaGlobal = prisma
