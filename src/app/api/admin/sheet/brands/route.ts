import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasAnyPermission, PERMISSIONS } from "@/lib/auth/permissions"
import { normalizeChannelInput, normalizeProfileInput } from "@/lib/farcaster/normalize-identifiers"

type SheetBrandRow = {
  bid: number
  name: string
  url: string | null
  description: string | null
  iconLogoUrl: string | null
  tokenTicker: string | null
  tokenContractAddress: string | null
  // Backward-compat alias consumed by some clients
  ticker: string | null
  category: string | null
  profile: string | null
  channel: string | null
  guardianFid: number | null
  founder: string | null
}

let cachedRows: SheetBrandRow[] = []
let cachedAtMs = 0
const SHEET_CACHE_TTL_MS = 5 * 60_000

const DEFAULT_SHEET_ID = "14gyWsl5RKuh1KohELC3zZbeW1Ywrtjd6x9T3jWqWhmI"
const DEFAULT_GID = "0"
const STRICT_MIN_SCORE = 300

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    if (ch === "\"") {
      if (inQuotes && csv[i + 1] === "\"") {
        cell += "\""
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === ",") {
      row.push(cell)
      cell = ""
      continue
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && csv[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }
    cell += ch
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function toObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) return []
  const headers = rows[0].map(normalizeHeader)
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim().length > 0))
    .map((r) => {
      const out: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        out[headers[i]] = (r[i] ?? "").trim()
      }
      return out
    })
}

function firstNonEmpty(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value && value.trim()) return value.trim()
  }
  return ""
}

function toPositiveInt(value: string): number | null {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) return null
    return parsed
}

function safeNormalizeProfile(value: string | null): string {
  if (!value) return ""
  try {
    return normalizeProfileInput(value)
  } catch {
    return ""
  }
}

function safeNormalizeChannel(value: string | null): string {
  if (!value) return ""
  try {
    return normalizeChannelInput(value)
  } catch {
    return ""
  }
}

function toCandidateTokens(query: string): { raw: string; numeric: number | null; profile: string; channel: string } {
  const raw = query.trim().toLowerCase()
  const numeric = /^\d+$/.test(raw) ? Number(raw) : null
  return {
    raw,
    numeric,
    profile: safeNormalizeProfile(raw),
    channel: safeNormalizeChannel(raw),
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev = new Array(b.length + 1).fill(0)
  const next = new Array(b.length + 1).fill(0)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    next[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      )
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j]
  }
  return prev[b.length]
}

function scoreRow(row: SheetBrandRow, query: string): { score: number; distance: number; reason: string } {
  const token = toCandidateTokens(query)
  if (!token.raw) return { score: 0, distance: 0, reason: "empty" }

  const name = row.name.toLowerCase()
  const ticker = (row.tokenTicker ?? row.ticker ?? "").toLowerCase()
  const channel = safeNormalizeChannel(row.channel)
  const profile = safeNormalizeProfile(row.profile)

  let score = 0
  let reason = "contains"

  if (token.numeric && row.bid === token.numeric) {
    score += 1000
    reason = "bid_exact"
  }

  if ((token.channel && channel && token.channel === channel) || (token.profile && profile && token.profile === profile)) {
    score += 700
    reason = reason === "bid_exact" ? "bid_exact+handle_exact" : "handle_exact"
  }

  if (token.raw && ticker && ticker === token.raw) {
    score += 500
    reason = reason.includes("exact") ? `${reason}+ticker_exact` : "ticker_exact"
  }

  if (token.raw && name.startsWith(token.raw)) {
    score += 300
    reason = reason.includes("exact") ? `${reason}+name_prefix` : "name_prefix"
  } else if (token.raw && name.includes(token.raw)) {
    score += 150
  }

  const distance = token.raw ? levenshtein(name, token.raw) : 0
  return { score, distance, reason }
}

function toSheetRows(rows: Array<Record<string, string>>): SheetBrandRow[] {
  const result: SheetBrandRow[] = []
  for (const row of rows) {
    const bid = toPositiveInt(firstNonEmpty(row, ["bid", "id", "brand id"]))
    const name = firstNonEmpty(row, ["name", "brand", "brand name"])
    if (!bid || !name) continue

    result.push({
      bid,
      name,
      url: firstNonEmpty(row, ["url"]) || null,
      description: firstNonEmpty(row, ["description"]) || null,
      iconLogoUrl: firstNonEmpty(row, ["icon logo url", "logo url", "image url"]) || null,
      tokenTicker: firstNonEmpty(row, ["token ticker", "ticker"]) || null,
      tokenContractAddress: firstNonEmpty(
        row,
        ["token contract", "token contract address", "contract address", "token address"],
      ) || null,
      ticker: firstNonEmpty(row, ["token ticker", "ticker"]) || null,
      category: firstNonEmpty(row, ["category"]) || null,
      profile: firstNonEmpty(row, ["profile"]) || null,
      channel: firstNonEmpty(row, ["channel"]) || null,
      guardianFid: toPositiveInt(firstNonEmpty(row, ["guardian fid", "guardianfid", "fid"])),
      founder: firstNonEmpty(row, ["founder"]) || null,
    })
  }
  return result.sort((a, b) => a.bid - b.bid)
}

async function loadSheetRows(): Promise<SheetBrandRow[]> {
  const now = Date.now()
  if (cachedRows.length > 0 && now - cachedAtMs < SHEET_CACHE_TTL_MS) return cachedRows

  const sheetId = process.env.BRANDS_SHEET_ID ?? DEFAULT_SHEET_ID
  const gid = process.env.BRANDS_SHEET_GID ?? DEFAULT_GID
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  const response = await fetch(csvUrl, {
    headers: { Accept: "text/csv" },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to load Google Sheet (${response.status})`)
  }

  const csv = await response.text()
  const objects = toObjects(parseCsv(csv))
  const rows = toSheetRows(objects)

  cachedRows = rows
  cachedAtMs = now
  return rows
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const sessionUser = session?.user as { fid?: number; role?: string } | undefined

    if (!sessionUser || typeof sessionUser.fid !== "number") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let canLookup = sessionUser.role === "admin"
    if (!canLookup) {
      const requester = await getAdminUser(sessionUser.fid)
      canLookup = hasAnyPermission(requester, [PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    }

    if (!canLookup) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") ?? "").trim().toLowerCase()
    const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1)
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1), 100)
    const skip = (page - 1) * limit

    const rows = await loadSheetRows()
    const filtered = q
      ? rows.filter((row) => {
          const haystack = [
            String(row.bid),
            row.name,
            row.profile ?? "",
            row.channel ?? "",
            row.tokenTicker ?? "",
            row.tokenContractAddress ?? "",
            row.ticker ?? "",
            row.category ?? "",
          ]
            .join(" ")
            .toLowerCase()
          return haystack.includes(q)
        })
      : rows

    const ranked = q
      ? filtered
          .map((row) => {
            const scored = scoreRow(row, q)
            return { row, ...scored }
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            if (a.distance !== b.distance) return a.distance - b.distance
            return a.row.bid - b.row.bid
          })
      : filtered.map((row) => ({ row, score: 0, distance: 0, reason: "none" }))

    const strictFiltered = q
      ? ranked.filter((entry) => entry.score >= STRICT_MIN_SCORE).map((entry) => entry.row)
      : ranked.map((entry) => entry.row)

    const totalCount = strictFiltered.length
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1)
    const pageRows = strictFiltered.slice(skip, skip + limit)

    return NextResponse.json({
      success: true,
      page,
      pageSize: limit,
      totalCount,
      totalPages,
      brands: pageRows,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("Admin sheet brand search error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
