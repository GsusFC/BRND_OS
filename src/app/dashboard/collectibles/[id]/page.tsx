import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getBrandsMetadata } from "@/lib/seasons/enrichment/brands"
import { getCollectibleByTokenId } from "@/lib/seasons"
import { getUsersMetadata } from "@/lib/seasons/enrichment/users"
import { PodiumSpot } from "@/components/dashboard/podiums/PodiumViews"
import { UserAvatar } from "@/components/users/UserAvatar"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const formatDate = (date: Date | null): string => {
  if (!date) return "-"
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const formatBrndAmount = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "-"
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return String(value)
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.trunc(parsed))
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

  const goldMeta = brandMeta.get(collectible.goldBrandId)
  const silverMeta = brandMeta.get(collectible.silverBrandId)
  const bronzeMeta = brandMeta.get(collectible.bronzeBrandId)

  const goldBrand = {
    id: collectible.goldBrandId,
    name: goldMeta?.name ?? `Brand #${collectible.goldBrandId}`,
    imageUrl: goldMeta?.imageUrl ?? null,
  }
  const silverBrand = {
    id: collectible.silverBrandId,
    name: silverMeta?.name ?? `Brand #${collectible.silverBrandId}`,
    imageUrl: silverMeta?.imageUrl ?? null,
  }
  const bronzeBrand = {
    id: collectible.bronzeBrandId,
    name: bronzeMeta?.name ?? `Brand #${collectible.bronzeBrandId}`,
    imageUrl: bronzeMeta?.imageUrl ?? null,
  }

  const userFids = new Set<number>()
  userFids.add(collectible.genesisCreatorFid)
  userFids.add(collectible.currentOwnerFid)
  sales.forEach((sale) => {
    userFids.add(sale.buyerFid)
    userFids.add(sale.sellerFid)
  })
  repeatFees.forEach((fee) => {
    userFids.add(fee.ownerFid)
  })
  ownershipHistory.forEach((entry) => {
    userFids.add(entry.ownerFid)
  })

  const userMeta = await getUsersMetadata(Array.from(userFids))
  const formatUser = (fid: number) => userMeta.get(fid)?.username ?? `FID ${fid}`
  const getAvatar = (fid: number) => userMeta.get(fid)?.pfpUrl ?? null

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
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">Podium</div>
          <div className="h-[280px] overflow-hidden flex items-end justify-center -mt-1">
            <div className="flex items-end justify-center gap-3 origin-bottom scale-[0.8]">
              <PodiumSpot place="silver" brand={silverBrand} />
              <PodiumSpot place="gold" brand={goldBrand} />
              <PodiumSpot place="bronze" brand={bronzeBrand} />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Ownership</div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Creator</span>
              <div className="flex items-center gap-2">
                <UserAvatar src={getAvatar(collectible.genesisCreatorFid)} alt={formatUser(collectible.genesisCreatorFid)} size={20} />
                <span className="text-white font-mono">{formatUser(collectible.genesisCreatorFid)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Owner</span>
              <div className="flex items-center gap-2">
                <UserAvatar src={getAvatar(collectible.currentOwnerFid)} alt={formatUser(collectible.currentOwnerFid)} size={20} />
                <span className="text-white font-mono">{formatUser(collectible.currentOwnerFid)}</span>
              </div>
            </div>
            <div>Wallet: <span className="text-zinc-400 font-mono break-all">{collectible.currentOwnerWallet}</span></div>
            <div className="text-xs text-zinc-500">Last updated: {formatDate(collectible.lastUpdated)}</div>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 bg-[#212020]/50 border-[#484E55]/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Economics</div>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>Current price: <span className="text-white font-mono">{formatBrndAmount(collectible.currentPrice)}</span> BRND</div>
            <div>Last sale: <span className="text-white font-mono">{formatBrndAmount(collectible.lastSalePrice)}</span> BRND</div>
            <div>Claim count: <Badge variant="outline" className="ml-1 font-mono">{collectible.claimCount}</Badge></div>
            <div>Total fees: <span className="text-white font-mono">{formatBrndAmount(collectible.totalFeesEarned)}</span> BRND</div>
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
                  <TableCell className="font-mono text-xs">{formatUser(sale.buyerFid)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatUser(sale.sellerFid)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatBrndAmount(sale.price)} BRND</TableCell>
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
                  <TableCell className="font-mono text-xs">{formatUser(fee.ownerFid)}</TableCell>
                  <TableCell className="font-mono text-xs">{fee.votesThatGeneratedFee}</TableCell>
                  <TableCell className="font-mono text-xs">{formatBrndAmount(fee.feeAmount)} BRND</TableCell>
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
                <TableCell className="font-mono text-xs">{formatUser(entry.ownerFid)}</TableCell>
                <TableCell className="text-xs">{entry.acquisitionType}</TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.pricePaid ? `${formatBrndAmount(entry.pricePaid)} BRND` : "-"}
                </TableCell>
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
