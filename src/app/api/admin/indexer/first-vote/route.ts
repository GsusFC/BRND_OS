import { NextRequest, NextResponse } from "next/server"
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
  const multiplier = BigInt(1000)

  return {
    epochMs: digits >= 13 ? epoch : epoch * multiplier,
    digits,
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hostHeader = request.headers.get("host") ?? ""
  const forwardedHostHeader = request.headers.get("x-forwarded-host") ?? ""
  const hostname = request.nextUrl.hostname

  const isDeployPreview =
    hostname.includes("deploy-preview") ||
    hostHeader.includes("deploy-preview") ||
    forwardedHostHeader.includes("deploy-preview") ||
    hostname.includes("localhost") ||
    hostHeader.includes("localhost") ||
    forwardedHostHeader.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostHeader.includes("127.0.0.1") ||
    forwardedHostHeader.includes("127.0.0.1")

  if (session.user.role !== "admin" && !isDeployPreview) {
    const shouldIncludeDebug = request.nextUrl.searchParams.get("debug") === "1"

    if (!shouldIncludeDebug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      {
        error: "Forbidden",
        debug: {
          hostname,
          hostHeader,
          forwardedHostHeader,
          role: session.user.role,
          isDeployPreview,
        },
      },
      { status: 403 }
    )
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

  const maxSafeIntegerAsBigInt = BigInt(Number.MAX_SAFE_INTEGER)

  if (epochMs > maxSafeIntegerAsBigInt) {
    throw new Error("Timestamp is larger than Number.MAX_SAFE_INTEGER")
  }

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
