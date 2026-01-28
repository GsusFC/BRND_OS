import prismaIndexer from "@/lib/prisma-indexer"
import { Decimal } from "@prisma/client/runtime/library"

const BRND_DECIMALS = BigInt(18)
const BRND_SCALE = BigInt(10) ** BRND_DECIMALS

const toDecimalString = (raw: Decimal | number | string | null | undefined): string => {
  if (raw === null || raw === undefined) return "0"
  if (typeof raw === "number") return Math.trunc(raw).toString()
  if (typeof raw === "string") return raw
  return raw.toFixed(0)
}

const formatTokenAmount = (raw: Decimal | number | string | null | undefined, precision = 4): string => {
  const str = toDecimalString(raw)
  if (!/^-?[0-9]+$/.test(str)) return "0"
  const value = BigInt(str)
  const whole = value / BRND_SCALE
  const frac = value % BRND_SCALE
  const fracStr = frac.toString().padStart(18, "0").slice(0, precision)
  return `${whole.toString()}.${fracStr}`
}

const toDateFromSeconds = (raw: Decimal | number | string | null | undefined): Date | null => {
  if (raw === null || raw === undefined) return null
  const str = toDecimalString(raw)
  if (!/^[0-9]+$/.test(str)) return null
  const seconds = Number(str)
  if (!Number.isFinite(seconds)) return null
  return new Date(seconds * 1000)
}

export interface IndexerCollectibleSummary {
  tokenId: number
  goldBrandId: number
  silverBrandId: number
  bronzeBrandId: number
  claimCount: number
  currentOwnerFid: number
  currentOwnerWallet: string
  currentPrice: string
  lastSalePrice: string
  totalFeesEarned: string
  createdAt: Date | null
  lastSaleAt: Date | null
  lastUpdated: Date | null
}

const mapCollectible = (row: {
  tokenId: number
  goldBrandId: number
  silverBrandId: number
  bronzeBrandId: number
  claimCount: number
  currentOwnerFid: number
  currentOwnerWallet: string
  currentPrice: Decimal
  lastSalePrice: Decimal
  totalFeesEarned: Decimal
  createdAt: Decimal
  lastSaleAt: Decimal | null
  lastUpdated: Decimal
}): IndexerCollectibleSummary => ({
  tokenId: row.tokenId,
  goldBrandId: row.goldBrandId,
  silverBrandId: row.silverBrandId,
  bronzeBrandId: row.bronzeBrandId,
  claimCount: row.claimCount,
  currentOwnerFid: row.currentOwnerFid,
  currentOwnerWallet: row.currentOwnerWallet,
  currentPrice: formatTokenAmount(row.currentPrice),
  lastSalePrice: formatTokenAmount(row.lastSalePrice),
  totalFeesEarned: formatTokenAmount(row.totalFeesEarned),
  createdAt: toDateFromSeconds(row.createdAt),
  lastSaleAt: toDateFromSeconds(row.lastSaleAt),
  lastUpdated: toDateFromSeconds(row.lastUpdated),
})

export async function getRecentCollectibles(limit = 6): Promise<IndexerCollectibleSummary[]> {
  const rows = await prismaIndexer.indexerPodiumCollectible.findMany({
    orderBy: { lastUpdated: "desc" },
    take: limit,
  })
  return rows.map(mapCollectible)
}

export async function getCollectiblesPage(options: {
  page?: number
  pageSize?: number
} = {}): Promise<{ collectibles: IndexerCollectibleSummary[]; totalCount: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 20, 100))
  const skip = (page - 1) * pageSize

  const [totalCount, rows] = await Promise.all([
    prismaIndexer.indexerPodiumCollectible.count(),
    prismaIndexer.indexerPodiumCollectible.findMany({
      orderBy: { lastUpdated: "desc" },
      skip,
      take: pageSize,
    }),
  ])

  return {
    collectibles: rows.map(mapCollectible),
    totalCount,
    page,
    pageSize,
  }
}
