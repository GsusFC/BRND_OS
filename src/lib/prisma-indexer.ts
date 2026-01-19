import { PrismaClient } from '@prisma/client-indexer'
import { withConnectionLimit } from "@/lib/prisma-utils"

declare global {
  var prismaIndexerGlobal: PrismaClient | undefined
}

const getIndexerSchemaFromUrl = (url: string): string | null => {
  const match = url.match(/(?:\?|&)schema=([^&]+)/)
  return match?.[1] ?? null
}

const getPrismaIndexerClient = (): PrismaClient => {
  const existing = globalThis.prismaIndexerGlobal
  if (existing) return existing

  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.INDEXER_DATABASE_URL
          ? withConnectionLimit(process.env.INDEXER_DATABASE_URL)
          : undefined,
      },
    },
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

    const schema = getIndexerSchemaFromUrl(process.env.INDEXER_DATABASE_URL)
    if (!schema) {
      throw new Error('INDEXER_DATABASE_URL must include an explicit "schema" query param (e.g. "?sslmode=require&schema=production-5")')
    }

    const client = getPrismaIndexerClient() as unknown as Record<PropertyKey, unknown>
    return client[prop]
  },
})

export default prismaIndexer
