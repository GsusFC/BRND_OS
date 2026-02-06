import { Pagination } from "@/components/ui/Pagination"
import { getCollectiblesPage } from "@/lib/seasons"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { getCollectibleImages } from "@/lib/collectibles/metadata"
import { isHttpImageSrc, normalizeImageSrc } from "@/lib/images/safe-src"
import Link from "next/link"

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

export default async function CollectiblesV3Page({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
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

  const rows = collectibles.map((item) => {
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
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 md:p-6 mb-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Experimental Gallery</div>
        <h1 className="text-2xl md:text-3xl font-black font-display text-white uppercase mt-1">Collectibles V3</h1>
        <p className="text-zinc-500 font-mono text-sm mt-2">
          Server-rendered resilient gallery • {totalCount.toLocaleString()} total
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-14 text-center">
          <p className="text-zinc-500 font-mono text-sm">No collectibles available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <Link
              key={row.tokenId}
              href={`/dashboard/collectibles/${row.tokenId}`}
              className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 hover:border-zinc-600 transition-all overflow-hidden"
            >
              {row.nftImageUrl ? (
                <div className="relative bg-zinc-900 h-[220px]">
                  <img
                    src={row.nftImageUrl}
                    alt={`Collectible #${row.tokenId}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="h-[220px] bg-[radial-gradient(circle_at_top_left,#3f3f46,transparent_55%),radial-gradient(circle_at_bottom_right,#a16207,transparent_50%),#09090b] p-3 flex flex-col justify-between">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-bold">Fallback Podium</div>
                  <div className="flex items-end gap-2">
                    {[{ medal: "🥈", name: row.silver.name }, { medal: "🥇", name: row.gold.name }, { medal: "🥉", name: row.bronze.name }].map((p) => (
                      <div key={`${row.tokenId}-${p.name}`} className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
                        <div className="text-xs">{p.medal}</div>
                        <div className="text-[10px] text-zinc-300 truncate">{p.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-zinc-500">Token #{row.tokenId}</div>
                  <div className="text-xs font-mono text-zinc-300">{row.currentPriceLabel} BRND</div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[row.gold, row.silver, row.bronze].map((brand) => (
                    <span
                      key={`${row.tokenId}-${brand.id}`}
                      className="text-[10px] font-mono rounded-md bg-zinc-900 border border-zinc-800 px-2 py-1 text-zinc-400"
                    >
                      {brand.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{row.lastSaleLabel}</span>
                  <span>{row.claimCount} claims</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-800">
                    {row.ownerAvatarUrl ? (
                      <img src={row.ownerAvatarUrl} alt={row.ownerLabel} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <span className="text-xs text-zinc-400 truncate">{row.ownerLabel}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination totalPages={totalPages} />
    </div>
  )
}
