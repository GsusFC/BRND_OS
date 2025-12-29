import { PrismaClient } from '@prisma/client-indexer'

declare global {
  var prismaIndexerGlobal: PrismaClient | undefined
}

const getPrismaIndexerClient = (): PrismaClient => {
  const existing = globalThis.prismaIndexerGlobal
  if (existing) return existing

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') globalThis.prismaIndexerGlobal = client
  return client
}

const prismaIndexer = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!process.env.INDEXER_DATABASE_URL) {
      throw new Error('INDEXER_DATABASE_URL is not defined')
    }

    const client = getPrismaIndexerClient() as unknown as Record<PropertyKey, unknown>
    return client[prop]
  },
})

export default prismaIndexer
