import { CollectiblesTable } from "@/components/dashboard/CollectiblesTable"
import { Pagination } from "@/components/ui/Pagination"
import { getCollectiblesPage } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { getCollectibleImages } from "@/lib/collectibles/metadata"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const PAGE_SIZE = 20

const formatDateLabel = (date: Date | null): string => {
  if (!date) return "-"
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

const formatBrndAmount = (value: string | number): string => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return String(value)
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.trunc(parsed))
}

export default async function CollectiblesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const pageRaw = params?.page
  const page = Math.max(1, Number(pageRaw) || 1)

  const { collectibles, totalCount } = await getCollectiblesPage({
    page,
    pageSize: PAGE_SIZE,
  })

  const brandIds = new Set<number>()
  const ownerFids = new Set<number>()
  for (const item of collectibles) {
    brandIds.add(item.goldBrandId)
    brandIds.add(item.silverBrandId)
    brandIds.add(item.bronzeBrandId)
    if (Number.isInteger(item.currentOwnerFid) && item.currentOwnerFid > 0) {
      ownerFids.add(item.currentOwnerFid)
    }
  }

  // Fetch brand metadata, owner metadata, and NFT images in parallel
  const [brandMeta, ownerMeta, nftImages] = await Promise.all([
    getBrandsMetadata(Array.from(brandIds)),
    getUsersMetadata(Array.from(ownerFids), { fetchMissingFromNeynar: true }),
    getCollectibleImages(collectibles.map((c) => c.tokenId)),
  ])

  const rows = collectibles.map((item) => ({
    tokenId: item.tokenId,
    nftImageUrl: nftImages.get(item.tokenId) ?? null,
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
    currentPrice: formatBrndAmount(item.currentPrice),
    claimCount: item.claimCount,
    ownerFid: item.currentOwnerFid,
    ownerLabel: (() => {
      const meta = ownerMeta.get(item.currentOwnerFid)
      const username = meta?.username ?? meta?.displayName ?? null
      return username ? `@${username}` : `FID ${item.currentOwnerFid}`
    })(),
    ownerAvatarUrl: ownerMeta.get(item.currentOwnerFid)?.pfpUrl ?? null,
    lastSaleLabel: formatDateLabel(item.lastSaleAt ?? item.createdAt),
  }))

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white font-display uppercase">Collectibles</h1>
          <p className="text-zinc-500 font-mono text-sm mt-1">
            Onchain podium NFTs • {totalCount.toLocaleString()} total
          </p>
        </div>
      </div>

      <div className="mt-8">
        <CollectiblesTable rows={rows} />
      </div>

      <Pagination totalPages={totalPages} />
    </div>
  )
}
