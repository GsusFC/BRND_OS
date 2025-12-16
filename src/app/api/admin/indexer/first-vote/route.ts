import { NextResponse } from "next/server"
import { auth } from "@/auth"

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

export const GET = auth(async (request) => {
  const shouldIncludeDebug = request.nextUrl.searchParams.get("debug") === "1"
  const shouldPing = request.nextUrl.searchParams.get("ping") === "1"
  const session = request.auth

  const indexerDsn = (() => {
    const raw = process.env.INDEXER_DATABASE_URL
    if (!raw) return null

    try {
      const url = new URL(raw)
      const sslmode = url.searchParams.get("sslmode")

      return {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || null,
        database: url.pathname.replace(/^\//, "") || null,
        sslmode,
      }
    } catch {
      return { invalidUrl: true }
    }
  })()

  if (shouldIncludeDebug && shouldPing) {
    return NextResponse.json({
      ok: true,
      debug: {
        commitRef: process.env.COMMIT_REF ?? null,
        context: process.env.CONTEXT ?? null,
        reviewId: process.env.REVIEW_ID ?? null,
        deployPrimeUrl: process.env.DEPLOY_PRIME_URL ?? null,
        hostname: request.nextUrl.hostname,
        hostHeader: request.headers.get("host") ?? "",
        forwardedHostHeader: request.headers.get("x-forwarded-host") ?? "",
        hasIndexerDatabaseUrl: !!process.env.INDEXER_DATABASE_URL,
        hasMysqlDatabaseUrl: !!process.env.MYSQL_DATABASE_URL,
        indexerDsn,
        nodeEnv: process.env.NODE_ENV ?? null,
        isAuthenticated: !!session?.user,
        role: session?.user?.role ?? null,
        fid: session?.user?.fid ?? null,
      },
    })
  }

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const fid = session.user.fid

  if (!fid) {
    if (!shouldIncludeDebug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      {
        error: "Forbidden",
        debug: {
          hostname: request.nextUrl.hostname,
          hostHeader: request.headers.get("host") ?? "",
          forwardedHostHeader: request.headers.get("x-forwarded-host") ?? "",
          role: session.user.role,
          fid: null,
        },
      },
      { status: 403 }
    )
  }

  try {
    const prismaIndexer = (await import("@/lib/prisma-indexer")).default

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
      ...(shouldIncludeDebug
        ? {
            debug: {
              hostname: request.nextUrl.hostname,
              hostHeader: request.headers.get("host") ?? "",
              forwardedHostHeader: request.headers.get("x-forwarded-host") ?? "",
              role: session.user.role,
              fid,
            },
          }
        : {}),
    })
  } catch (error: unknown) {
    if (!shouldIncludeDebug) {
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }

    const message = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: "Internal Server Error",
        debug: {
          message,
          hostname: request.nextUrl.hostname,
          hostHeader: request.headers.get("host") ?? "",
          forwardedHostHeader: request.headers.get("x-forwarded-host") ?? "",
          role: session.user.role,
          fid,
        },
      },
      { status: 500 }
    )
  }
})
