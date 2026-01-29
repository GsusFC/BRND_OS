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
  genesisCreatorFid: number
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

export interface IndexerCollectibleSale {
  id: string
  tokenId: number
  buyerFid: number
  sellerFid: number
  buyerWallet: string
  sellerWallet: string
  price: string
  sellerProceeds: string
  genesisRoyalty: string
  protocolFee: string
  claimNumber: number
  timestamp: Date | null
}

export interface IndexerCollectibleRepeatFee {
  id: string
  tokenId: number
  ownerFid: number
  ownerWallet: string
  feeAmount: string
  votesThatGeneratedFee: number
  timestamp: Date | null
  claimNonce: number
}

export interface IndexerCollectibleOwnership {
  id: string
  tokenId: number
  ownerFid: number
  ownerWallet: string
  acquisitionType: string
  pricePaid: string | null
  acquiredAt: Date | null
}

export interface IndexerCollectibleDetail {
  collectible: IndexerCollectibleSummary
  sales: IndexerCollectibleSale[]
  repeatFees: IndexerCollectibleRepeatFee[]
  ownershipHistory: IndexerCollectibleOwnership[]
}

const mapCollectible = (row: {
  tokenId: number
  goldBrandId: number
  silverBrandId: number
  bronzeBrandId: number
  genesisCreatorFid: number
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
  genesisCreatorFid: row.genesisCreatorFid,
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

const mapSale = (row: {
  id: string
  tokenId: number
  buyerFid: number
  sellerFid: number
  buyerWallet: string
  sellerWallet: string
  price: Decimal
  sellerProceeds: Decimal
  genesisRoyalty: Decimal
  protocolFee: Decimal
  claimNumber: number
  timestamp: Decimal
}): IndexerCollectibleSale => ({
  id: row.id,
  tokenId: row.tokenId,
  buyerFid: row.buyerFid,
  sellerFid: row.sellerFid,
  buyerWallet: row.buyerWallet,
  sellerWallet: row.sellerWallet,
  price: formatTokenAmount(row.price),
  sellerProceeds: formatTokenAmount(row.sellerProceeds),
  genesisRoyalty: formatTokenAmount(row.genesisRoyalty),
  protocolFee: formatTokenAmount(row.protocolFee),
  claimNumber: row.claimNumber,
  timestamp: toDateFromSeconds(row.timestamp),
})

const mapRepeatFee = (row: {
  id: string
  tokenId: number
  ownerFid: number
  ownerWallet: string
  feeAmount: Decimal
  votesThatGeneratedFee: number
  timestamp: Decimal
  claimNonce: number
}): IndexerCollectibleRepeatFee => ({
  id: row.id,
  tokenId: row.tokenId,
  ownerFid: row.ownerFid,
  ownerWallet: row.ownerWallet,
  feeAmount: formatTokenAmount(row.feeAmount),
  votesThatGeneratedFee: row.votesThatGeneratedFee,
  timestamp: toDateFromSeconds(row.timestamp),
  claimNonce: row.claimNonce,
})

const mapOwnership = (row: {
  id: string
  tokenId: number
  ownerFid: number
  ownerWallet: string
  acquisitionType: string
  pricePaid: Decimal | null
  acquiredAt: Decimal
}): IndexerCollectibleOwnership => ({
  id: row.id,
  tokenId: row.tokenId,
  ownerFid: row.ownerFid,
  ownerWallet: row.ownerWallet,
  acquisitionType: row.acquisitionType,
  pricePaid: row.pricePaid ? formatTokenAmount(row.pricePaid) : null,
  acquiredAt: toDateFromSeconds(row.acquiredAt),
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

export async function getCollectibleByTokenId(tokenId: number): Promise<IndexerCollectibleDetail | null> {
  const collectible = await prismaIndexer.indexerPodiumCollectible.findUnique({
    where: { tokenId },
  })

  if (!collectible) return null

  const [sales, repeatFees, ownershipHistory] = await Promise.all([
    prismaIndexer.indexerCollectibleSale.findMany({
      where: { tokenId },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
    prismaIndexer.indexerCollectibleRepeatFee.findMany({
      where: { tokenId },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
    prismaIndexer.indexerCollectibleOwnershipHistory.findMany({
      where: { tokenId },
      orderBy: { acquiredAt: "desc" },
      take: 50,
    }),
  ])

  return {
    collectible: mapCollectible(collectible),
    sales: sales.map(mapSale),
    repeatFees: repeatFees.map(mapRepeatFee),
    ownershipHistory: ownershipHistory.map(mapOwnership),
  }
}

export async function getCollectiblesByBrand(brandId: number, limit = 6): Promise<IndexerCollectibleSummary[]> {
  const rows = await prismaIndexer.indexerPodiumCollectible.findMany({
    where: {
      OR: [
        { goldBrandId: brandId },
        { silverBrandId: brandId },
        { bronzeBrandId: brandId },
      ],
    },
    orderBy: { lastUpdated: "desc" },
    take: limit,
  })

  return rows.map(mapCollectible)
}
