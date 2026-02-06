import { CollectiblesV3Grid, type CollectiblesV3Row } from "@/components/dashboard/CollectiblesV3Grid"
import { Pagination } from "@/components/ui/Pagination"
import { getCollectiblesPage } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { getCollectibleImages } from "@/lib/collectibles/metadata"
import { isHttpImageSrc, normalizeImageSrc } from "@/lib/images/safe-src"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const PAGE_SIZE = 24

const formatDateLabel = (date: Date | null): string => {
  if (!date) return "-"
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

const formatPrice = (value: string | number): { numeric: number; label: string } => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return { numeric: 0, label: "0" }
  return {
    numeric: parsed,
    label: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.trunc(parsed)),
  }
}

const toSafeNftImage = (value: string | null | undefined): string | null => {
  const normalized = normalizeImageSrc(value)
  if (!normalized) return null
  if (!isHttpImageSrc(normalized)) return null
  if (normalized.length > 2048) return null
  return normalized
}

export default async function CollectiblesV3Page({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params?.page) || 1)

  const { collectibles, totalCount } = await getCollectiblesPage({ page, pageSize: PAGE_SIZE })

  const brandIds = new Set<number>()
  const ownerFids = new Set<number>()
  for (const item of collectibles) {
    brandIds.add(item.goldBrandId)
    brandIds.add(item.silverBrandId)
    brandIds.add(item.bronzeBrandId)
    if (Number.isInteger(item.currentOwnerFid) && item.currentOwnerFid > 0) ownerFids.add(item.currentOwnerFid)
  }

  const [brandMeta, ownerMeta, nftImages] = await Promise.all([
    getBrandsMetadata(Array.from(brandIds)),
    getUsersMetadata(Array.from(ownerFids), { fetchMissingFromNeynar: true }),
    getCollectibleImages(collectibles.map((item) => item.tokenId)),
  ])

  const rows: CollectiblesV3Row[] = collectibles.map((item) => {
    const price = formatPrice(item.currentPrice)
    const owner = ownerMeta.get(item.currentOwnerFid)
    return {
      tokenId: item.tokenId,
      nftImageUrl: toSafeNftImage(nftImages.get(item.tokenId) ?? null),
      gold: {
        id: item.goldBrandId,
        name: brandMeta.get(item.goldBrandId)?.name ?? `Brand #${item.goldBrandId}`,
        imageUrl: brandMeta.get(item.goldBrandId)?.imageUrl ?? null,
      },
      silver: {
        id: item.silverBrandId,
        name: brandMeta.get(item.silverBrandId)?.name ?? `Brand #${item.silverBrandId}`,
        imageUrl: brandMeta.get(item.silverBrandId)?.imageUrl ?? null,
      },
      bronze: {
        id: item.bronzeBrandId,
        name: brandMeta.get(item.bronzeBrandId)?.name ?? `Brand #${item.bronzeBrandId}`,
        imageUrl: brandMeta.get(item.bronzeBrandId)?.imageUrl ?? null,
      },
      currentPrice: price.numeric,
      currentPriceLabel: price.label,
      claimCount: item.claimCount,
      ownerLabel: owner?.username ? `@${owner.username}` : owner?.displayName ? owner.displayName : `FID ${item.currentOwnerFid}`,
      ownerAvatarUrl: owner?.pfpUrl ?? null,
      lastSaleLabel: formatDateLabel(item.lastSaleAt ?? item.createdAt),
    }
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="w-full">
      <CollectiblesV3Grid rows={rows} />
      <Pagination totalPages={totalPages} />
    </div>
  )
}
