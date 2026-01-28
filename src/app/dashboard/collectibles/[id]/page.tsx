import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getCollectibleByTokenId } from "@/lib/seasons"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const formatDate = (date: Date | null): string => {
  if (!date) return "-"
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default async function CollectibleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tokenId = Number(id)
  if (!Number.isFinite(tokenId)) notFound()

  const detail = await getCollectibleByTokenId(tokenId)
  if (!detail) notFound()

  const { collectible, sales, repeatFees, ownershipHistory } = detail
  const brandMeta = await getBrandsMetadata([
    collectible.goldBrandId,
    collectible.silverBrandId,
    collectible.bronzeBrandId,
  ])

  const goldName = brandMeta.get(collectible.goldBrandId)?.name ?? `Brand #${collectible.goldBrandId}`
  const silverName = brandMeta.get(collectible.silverBrandId)?.name ?? `Brand #${collectible.silverBrandId}`
  const bronzeName = brandMeta.get(collectible.bronzeBrandId)?.name ?? `Brand #${collectible.bronzeBrandId}`

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white font-display uppercase">Collectible #{collectible.tokenId}</h1>
          <p className="text-zinc-500 font-mono text-sm mt-1">Podium NFT details</p>
        </div>
        <Link href="/dashboard/collectibles" className="text-xs font-mono text-zinc-400 hover:text-white transition-colors">
          Back to Collectibles
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Podium</div>
          <div className="space-y-2 text-sm">
            <Link href={`/dashboard/brands/${collectible.goldBrandId}`} className="text-yellow-400 hover:text-yellow-300 transition-colors">
              🥇 {goldName}
            </Link>
            <Link href={`/dashboard/brands/${collectible.silverBrandId}`} className="text-zinc-300 hover:text-white transition-colors">
              🥈 {silverName}
            </Link>
            <Link href={`/dashboard/brands/${collectible.bronzeBrandId}`} className="text-amber-500 hover:text-amber-300 transition-colors">
              🥉 {bronzeName}
            </Link>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Ownership</div>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>Owner FID: <span className="text-white font-mono">{collectible.currentOwnerFid}</span></div>
            <div>Wallet: <span className="text-zinc-400 font-mono break-all">{collectible.currentOwnerWallet}</span></div>
            <div className="text-xs text-zinc-500">Last updated: {formatDate(collectible.lastUpdated)}</div>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Economics</div>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>Current price: <span className="text-white font-mono">{collectible.currentPrice}</span> BRND</div>
            <div>Last sale: <span className="text-white font-mono">{collectible.lastSalePrice}</span> BRND</div>
            <div>Claim count: <Badge variant="outline" className="ml-1 font-mono">{collectible.claimCount}</Badge></div>
            <div>Total fees: <span className="text-white font-mono">{collectible.totalFeesEarned}</span> BRND</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Sales History</div>
            <span className="text-xs font-mono text-zinc-500">{sales.length} entries</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs">FID {sale.buyerFid}</TableCell>
                  <TableCell className="font-mono text-xs">FID {sale.sellerFid}</TableCell>
                  <TableCell className="font-mono text-xs">{sale.price} BRND</TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(sale.timestamp)}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-500 text-sm">
                    No sales yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Repeat Fees</div>
            <span className="text-xs font-mono text-zinc-500">{repeatFees.length} entries</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Votes</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repeatFees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-mono text-xs">FID {fee.ownerFid}</TableCell>
                  <TableCell className="font-mono text-xs">{fee.votesThatGeneratedFee}</TableCell>
                  <TableCell className="font-mono text-xs">{fee.feeAmount} BRND</TableCell>
                  <TableCell className="text-xs text-zinc-500">{formatDate(fee.timestamp)}</TableCell>
                </TableRow>
              ))}
              {repeatFees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-500 text-sm">
                    No repeat fees yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Ownership History</div>
          <span className="text-xs font-mono text-zinc-500">{ownershipHistory.length} entries</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ownershipHistory.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs">FID {entry.ownerFid}</TableCell>
                <TableCell className="text-xs">{entry.acquisitionType}</TableCell>
                <TableCell className="font-mono text-xs">{entry.pricePaid ? `${entry.pricePaid} BRND` : "-"}</TableCell>
                <TableCell className="text-xs text-zinc-500">{formatDate(entry.acquiredAt)}</TableCell>
              </TableRow>
            ))}
            {ownershipHistory.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500 text-sm">
                  No ownership history yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
