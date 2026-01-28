"use client"

import Link from "next/link"
import { useState } from "react"
import { PodiumListLink, PodiumSpot, type PodiumBrand } from "@/components/dashboard/podiums/PodiumViews"
import { cn } from "@/lib/utils"

type CollectiblePodium = {
  tokenId: number
  gold: PodiumBrand
  silver: PodiumBrand
  bronze: PodiumBrand
  price: string
  claimCount: number
  lastUpdatedLabel: string
}

type ViewMode = "visual" | "compact"

export function LatestCollectibles({ items }: { items: CollectiblePodium[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("visual")

  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-800">
        <p className="text-zinc-600 font-mono text-sm">No collectibles yet</p>
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
          {items.map((item) => (
            <Link
              key={item.tokenId}
              href={`/dashboard/collectibles/${item.tokenId}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-zinc-500">Token #{item.tokenId}</span>
                <span className="text-xs font-mono text-zinc-400">{item.price} BRND</span>
              </div>
              <div className="h-[220px] overflow-hidden">
                <div className="flex items-end justify-center gap-3 origin-top scale-[0.65]">
                  <PodiumSpot place="silver" brand={item.silver} />
                  <PodiumSpot place="gold" brand={item.gold} />
                  <PodiumSpot place="bronze" brand={item.bronze} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>{item.claimCount} claims</span>
                <span>{item.lastUpdatedLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.tokenId}
              href={`/dashboard/collectibles/${item.tokenId}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-zinc-500">Token #{item.tokenId}</span>
                <span className="text-xs font-mono text-zinc-400">{item.price} BRND</span>
              </div>
              <div className="flex flex-col gap-2">
                <PodiumListLink brand={item.gold} medal="🥇" />
                <PodiumListLink brand={item.silver} medal="🥈" />
                <PodiumListLink brand={item.bronze} medal="🥉" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>{item.claimCount} claims</span>
                <span>{item.lastUpdatedLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
