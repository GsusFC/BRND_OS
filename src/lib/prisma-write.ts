import { PrismaClient } from '@prisma/client-write'

const prismaWriteClientSingleton = () => {
    return new PrismaClient()
}

declare global {
    var prismaWriteGlobal: undefined | ReturnType<typeof prismaWriteClientSingleton>
}

const prismaWrite = globalThis.prismaWriteGlobal ?? prismaWriteClientSingleton()

export default prismaWrite

if (process.env.NODE_ENV !== 'production') globalThis.prismaWriteGlobal = prismaWrite
