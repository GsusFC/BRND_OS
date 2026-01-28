import { CollectiblesTable } from "@/components/dashboard/CollectiblesTable"
import { Pagination } from "@/components/ui/Pagination"
import { getCollectiblesPage } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const PAGE_SIZE = 20

const formatDateLabel = (date: Date | null): string => {
  if (!date) return "-"
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
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
  for (const item of collectibles) {
    brandIds.add(item.goldBrandId)
    brandIds.add(item.silverBrandId)
    brandIds.add(item.bronzeBrandId)
  }

  const brandMeta = await getBrandsMetadata(Array.from(brandIds))

  const rows = collectibles.map((item) => ({
    tokenId: item.tokenId,
    gold: {
      id: item.goldBrandId,
      name: brandMeta.get(item.goldBrandId)?.name ?? `Brand #${item.goldBrandId}`,
    },
    silver: {
      id: item.silverBrandId,
      name: brandMeta.get(item.silverBrandId)?.name ?? `Brand #${item.silverBrandId}`,
    },
    bronze: {
      id: item.bronzeBrandId,
      name: brandMeta.get(item.bronzeBrandId)?.name ?? `Brand #${item.bronzeBrandId}`,
    },
    currentPrice: item.currentPrice,
    claimCount: item.claimCount,
    ownerFid: item.currentOwnerFid,
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
