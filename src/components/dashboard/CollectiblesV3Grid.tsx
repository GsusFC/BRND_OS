"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Grid3X3, List, Search, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

type V3Brand = {
  id: number
  name: string
  imageUrl: string | null
}

export type CollectiblesV3Row = {
  tokenId: number
  nftImageUrl: string | null
  gold: V3Brand
  silver: V3Brand
  bronze: V3Brand
  currentPrice: number
  currentPriceLabel: string
  claimCount: number
  ownerLabel: string
  ownerAvatarUrl: string | null
  lastSaleLabel: string
}

type CardMode = "grid" | "list"
type ImageFilter = "all" | "with-image" | "fallback-only"
type SortMode = "recent" | "price" | "claims"

export function CollectiblesV3Grid({ rows }: { rows: CollectiblesV3Row[] }) {
  const [query, setQuery] = useState("")
  const [cardMode, setCardMode] = useState<CardMode>("grid")
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const [failedImages, setFailedImages] = useState<Record<number, true>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = rows.filter((row) => {
      const hasImage = Boolean(row.nftImageUrl) && !failedImages[row.tokenId]
      if (imageFilter === "with-image" && !hasImage) return false
      if (imageFilter === "fallback-only" && hasImage) return false

      if (!q) return true
      return (
        String(row.tokenId).includes(q) ||
        row.gold.name.toLowerCase().includes(q) ||
        row.silver.name.toLowerCase().includes(q) ||
        row.bronze.name.toLowerCase().includes(q) ||
        row.ownerLabel.toLowerCase().includes(q)
      )
    })

    if (sortMode === "price") return [...base].sort((a, b) => b.currentPrice - a.currentPrice)
    if (sortMode === "claims") return [...base].sort((a, b) => b.claimCount - a.claimCount)
    return base
  }, [rows, query, imageFilter, sortMode, failedImages])

  const summary = useMemo(() => {
    const withImage = filtered.filter((row) => Boolean(row.nftImageUrl) && !failedImages[row.tokenId]).length
    const avgPrice =
      filtered.length > 0 ? filtered.reduce((acc, row) => acc + row.currentPrice, 0) / filtered.length : 0
    return { withImage, avgPrice }
  }, [filtered, failedImages])

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-14 text-center">
        <p className="text-zinc-500 font-mono text-sm">No collectibles available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Experimental Gallery</div>
            <h2 className="text-2xl md:text-3xl font-black font-display text-white uppercase mt-1">Collectibles V3</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500 font-mono">Visible</div>
              <div className="text-sm font-bold text-white">{filtered.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500 font-mono">With NFT</div>
              <div className="text-sm font-bold text-white">{summary.withImage}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500 font-mono">Avg Price</div>
              <div className="text-sm font-bold text-white">{summary.avgPrice.toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search token, brand, owner"
              className="w-full rounded-xl border border-zinc-800 bg-black/60 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <select
            value={imageFilter}
            onChange={(e) => setImageFilter(e.target.value as ImageFilter)}
            className="rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-300"
          >
            <option value="all">All cards</option>
            <option value="with-image">With real image</option>
            <option value="fallback-only">Fallback only</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-300"
          >
            <option value="recent">Sort: Recent</option>
            <option value="price">Sort: Price</option>
            <option value="claims">Sort: Claims</option>
          </select>
          <div className="flex rounded-xl border border-zinc-800 bg-black/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setCardMode("grid")}
              className={cn(
                "px-3 py-2 text-xs font-mono flex items-center gap-1.5",
                cardMode === "grid" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setCardMode("list")}
              className={cn(
                "px-3 py-2 text-xs font-mono flex items-center gap-1.5 border-l border-zinc-800",
                cardMode === "list" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              )}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      <div className={cn(cardMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3")}>
        {filtered.map((row) => {
          const hasImage = Boolean(row.nftImageUrl) && !failedImages[row.tokenId]
          return (
            <Link
              key={row.tokenId}
              href={`/dashboard/collectibles/${row.tokenId}`}
              className={cn(
                "group rounded-2xl border border-zinc-800 bg-zinc-950/70 hover:border-zinc-600 transition-all overflow-hidden",
                cardMode === "list" ? "flex items-stretch" : ""
              )}
            >
              <div className={cn(cardMode === "list" ? "w-40 shrink-0" : "w-full")}>
                {hasImage && row.nftImageUrl ? (
                  <div className="relative bg-zinc-900 h-full min-h-[170px]">
                    <img
                      src={row.nftImageUrl}
                      alt={`Collectible #${row.tokenId}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={() => setFailedImages((prev) => ({ ...prev, [row.tokenId]: true }))}
                    />
                  </div>
                ) : (
                  <div className="h-full min-h-[170px] bg-[radial-gradient(circle_at_top_left,#3f3f46,transparent_55%),radial-gradient(circle_at_bottom_right,#a16207,transparent_50%),#09090b] p-3 flex flex-col justify-between">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-bold">Fallback Podium</div>
                    <div className="flex items-end gap-2">
                      {[
                        { medal: "🥈", name: row.silver.name },
                        { medal: "🥇", name: row.gold.name },
                        { medal: "🥉", name: row.bronze.name },
                      ].map((p) => (
                        <div key={`${row.tokenId}-${p.name}`} className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
                          <div className="text-xs">{p.medal}</div>
                          <div className="text-[10px] text-zinc-300 truncate">{p.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 min-w-0">
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
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-10 text-center">
          <SlidersHorizontal className="w-5 h-5 text-zinc-500 mx-auto mb-2" />
          <p className="text-zinc-500 font-mono text-sm">No results with current filters.</p>
        </div>
      ) : null}
    </div>
  )
}
