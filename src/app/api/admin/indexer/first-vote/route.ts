import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prismaIndexer from "@/lib/prisma-indexer"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const parseEpochMsFromDecimalString: (value: string) => {
  epochMs: bigint
  digits: number
} = (value) => {
  const raw = value.includes(".") ? value.split(".")[0] ?? value : value
  const trimmed = raw.trim()

  if (!trimmed) {
    throw new Error("Invalid timestamp")
  }

  const epoch = BigInt(trimmed)
  const digits = epoch.toString().length

  return {
    epochMs: digits >= 13 ? epoch : epoch * 1000n,
    digits,
  }
}

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const firstVote = await prismaIndexer.indexerVote.findFirst({
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      fid: true,
      voter: true,
      brandIds: true,
      timestamp: true,
      blockNumber: true,
      transactionHash: true,
    },
  })

  if (!firstVote) {
    return NextResponse.json({
      data: null,
      message: "No votes found",
    })
  }

  const timestampRaw = firstVote.timestamp.toString()
  const { epochMs, digits } = parseEpochMsFromDecimalString(timestampRaw)
  const startAtUTC = new Date(Number(epochMs)).toISOString()

  return NextResponse.json({
    data: {
      id: firstVote.id,
      fid: firstVote.fid,
      voter: firstVote.voter,
      brandIds: firstVote.brandIds,
      timestampRaw,
      timestampDigits: digits,
      startAtUTC,
      blockNumber: firstVote.blockNumber.toString(),
      transactionHash: firstVote.transactionHash,
    },
  })
}
