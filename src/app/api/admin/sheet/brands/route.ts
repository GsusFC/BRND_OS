import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminUser } from "@/lib/auth/admin-user-server"
import { hasAnyPermission, PERMISSIONS } from "@/lib/auth/permissions"

type SheetBrandRow = {
  bid: number
  name: string
  url: string | null
  description: string | null
  iconLogoUrl: string | null
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
      ticker: firstNonEmpty(row, ["ticker"]) || null,
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
            row.ticker ?? "",
            row.category ?? "",
          ]
            .join(" ")
            .toLowerCase()
          return haystack.includes(q)
        })
      : rows

    const totalCount = filtered.length
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1)
    const pageRows = filtered.slice(skip, skip + limit)

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
