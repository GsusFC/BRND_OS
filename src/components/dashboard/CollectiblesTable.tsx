import Link from "next/link"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type CollectibleRow = {
  tokenId: number
  gold: { id: number; name: string }
  silver: { id: number; name: string }
  bronze: { id: number; name: string }
  currentPrice: string
  claimCount: number
  ownerFid: number
  lastSaleLabel: string
}

export function CollectiblesTable({ rows }: { rows: CollectibleRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center border border-[#484E55] rounded-lg">
        <p className="text-zinc-500 font-mono text-sm">No collectibles found.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[90px]">Token</TableHead>
          <TableHead>Podium</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Claims</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Last Sale</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.tokenId} className="hover:bg-[#212020]/50 transition-colors">
            <TableCell className="font-mono text-sm text-zinc-300">
              #{row.tokenId}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1 text-xs">
                <Link href={`/dashboard/brands/${row.gold.id}`} className="text-yellow-400 hover:text-yellow-300 transition-colors">
                  🥇 {row.gold.name}
                </Link>
                <Link href={`/dashboard/brands/${row.silver.id}`} className="text-zinc-300 hover:text-white transition-colors">
                  🥈 {row.silver.name}
                </Link>
                <Link href={`/dashboard/brands/${row.bronze.id}`} className="text-amber-500 hover:text-amber-300 transition-colors">
                  🥉 {row.bronze.name}
                </Link>
              </div>
            </TableCell>
            <TableCell className="font-mono text-sm text-zinc-300">
              {row.currentPrice} BRND
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="font-mono">
                {row.claimCount}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs text-zinc-400">
              FID {row.ownerFid}
            </TableCell>
            <TableCell className="text-xs text-zinc-500 font-mono">
              {row.lastSaleLabel}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
