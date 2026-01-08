import { PrismaClient } from '@prisma/client'

const prismaWriteClientSingleton = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'query'] : ['error'],
    })
}

declare global {
    var prismaWriteGlobal: undefined | ReturnType<typeof prismaWriteClientSingleton>
}

const prismaWrite = globalThis.prismaWriteGlobal ?? prismaWriteClientSingleton()

export default prismaWrite

if (process.env.NODE_ENV !== 'production') globalThis.prismaWriteGlobal = prismaWrite
