import { PrismaClient } from '@prisma/client-indexer'

if (!process.env.INDEXER_DATABASE_URL) {
  throw new Error('INDEXER_DATABASE_URL is not defined')
}

const prismaIndexerClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

declare global {
  var prismaIndexerGlobal: undefined | ReturnType<typeof prismaIndexerClientSingleton>
}

const prismaIndexer = globalThis.prismaIndexerGlobal ?? prismaIndexerClientSingleton()

export default prismaIndexer

if (process.env.NODE_ENV !== 'production') globalThis.prismaIndexerGlobal = prismaIndexer
