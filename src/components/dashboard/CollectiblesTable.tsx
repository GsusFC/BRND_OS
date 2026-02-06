"use client"

import Link from "next/link"
import { useState } from "react"
import { PodiumSpot, PodiumListLink, type PodiumBrand } from "@/components/dashboard/podiums/PodiumViews"
import { cn } from "@/lib/utils"
import { canRenderImageSrc, normalizeImageSrc } from "@/lib/images/safe-src"

type CollectibleRow = {
  tokenId: number
  nftImageUrl?: string | null
  gold: PodiumBrand
  silver: PodiumBrand
  bronze: PodiumBrand
  currentPrice: string
  claimCount: number
  ownerFid: number
  ownerLabel: string
  ownerAvatarUrl: string | null
  lastSaleLabel: string
}

type ViewMode = "visual" | "compact"

export function CollectiblesTable({ rows }: { rows: CollectibleRow[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("visual")

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center border border-[#484E55] rounded-lg">
        <p className="text-zinc-500 font-mono text-sm">No collectibles found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("visual")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors",
              viewMode === "visual"
                ? "border-white bg-white text-black"
                : "border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600"
            )}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setViewMode("compact")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors",
              viewMode === "compact"
                ? "border-white bg-white text-black"
                : "border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600"
            )}
          >
            Compact
          </button>
        </div>
      </div>

      {viewMode === "visual" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => {
            const nftImageUrl = normalizeImageSrc(row.nftImageUrl)
            const canRenderNftImage = canRenderImageSrc(nftImageUrl)

            return (
              <Link
                key={row.tokenId}
                href={`/dashboard/collectibles/${row.tokenId}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition-colors group"
              >
                {/* NFT Image or Podium fallback */}
                {canRenderNftImage ? (
                  <div className="aspect-square relative bg-zinc-900">
                    {nftImageUrl ? (
                      <img
                        src={nftImageUrl}
                        alt={`Collectible #${row.tokenId}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="h-[260px] overflow-hidden flex items-end justify-center">
                      <div className="flex items-end justify-center gap-3 origin-bottom scale-[0.75]">
                        <PodiumSpot place="silver" brand={row.silver} />
                        <PodiumSpot place="gold" brand={row.gold} />
                        <PodiumSpot place="bronze" brand={row.bronze} />
                      </div>
                    </div>
                  </div>
                )}
                {/* Stats footer */}
                <div className="p-4 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-500">#{row.tokenId}</span>
                    <span className="text-xs font-mono text-zinc-400">{row.currentPrice} BRND</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>{row.lastSaleLabel}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-800">
                        {row.ownerAvatarUrl ? (
                          <img src={row.ownerAvatarUrl} alt={row.ownerLabel} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500">
                            @
                          </div>
                        )}
                      </div>
                      <span className="text-zinc-400">{row.ownerLabel}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <div
              key={row.tokenId}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-zinc-500">Token #{row.tokenId}</span>
                <Link
                  href={`/dashboard/collectibles/${row.tokenId}`}
                  className="text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  {row.currentPrice} BRND
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PodiumListLink brand={row.gold} medal="🥇" />
                <PodiumListLink brand={row.silver} medal="🥈" />
                <PodiumListLink brand={row.bronze} medal="🥉" />
              </div>
          <div className="mt-3" />
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <Link
              href={`/dashboard/collectibles/${row.tokenId}`}
              className="hover:text-white transition-colors"
            >
              {row.lastSaleLabel}
            </Link>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-800">
                {row.ownerAvatarUrl ? (
                  <img src={row.ownerAvatarUrl} alt={row.ownerLabel} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500">
                    @
                  </div>
                )}
              </div>
              <span className="text-zinc-400">{row.ownerLabel}</span>
            </div>
          </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
