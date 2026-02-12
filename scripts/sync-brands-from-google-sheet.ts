import "dotenv/config"
import { writeFile } from "node:fs/promises"
import path from "node:path"

type CsvRow = Record<string, string>

type SnapshotBrand = {
  name: string
  imageUrl: string | null
  channel: string | null
}

const DEFAULT_SHEET_ID = "14gyWsl5RKuh1KohELC3zZbeW1Ywrtjd6x9T3jWqWhmI"
const DEFAULT_SHEET_GID = "0"

const SHEET_ID = process.env.BRANDS_SHEET_ID ?? DEFAULT_SHEET_ID
const SHEET_GID = process.env.BRANDS_SHEET_GID ?? DEFAULT_SHEET_GID

const OUTPUT_PATH = path.join(process.cwd(), "public/data/brands.json")

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function normalizeChannel(value: string): string | null {
  const clean = value.trim().replace(/\s+/g, "")
  if (!clean) return null
  return clean.startsWith("/") ? clean : `/${clean}`
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

function toObjects(rows: string[][]): CsvRow[] {
  if (rows.length === 0) return []
  const headers = rows[0].map(normalizeHeader)
  const body = rows.slice(1)

  return body
    .filter((r) => r.some((cell) => cell.trim().length > 0))
    .map((r) => {
      const out: CsvRow = {}
      for (let i = 0; i < headers.length; i++) {
        out[headers[i]] = (r[i] ?? "").trim()
      }
      return out
    })
}

function firstNonEmpty(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value && value.trim().length > 0) return value.trim()
  }
  return ""
}

function getBrandId(row: CsvRow): number | null {
  const raw = firstNonEmpty(row, ["bid", "id", "brand id", "brandid"])
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function toSnapshot(rows: CsvRow[]): Record<string, SnapshotBrand> {
  const out = new Map<number, SnapshotBrand>()

  for (const row of rows) {
    const id = getBrandId(row)
    if (!id) continue

    const name = firstNonEmpty(row, ["name", "brand", "brand name"])
    if (!name) continue

    const imageUrlRaw = firstNonEmpty(row, [
      "icon logo url",
      "icon url",
      "logo url",
      "image url",
      "imageurl",
    ])
    const channelRaw = firstNonEmpty(row, ["channel"])

    out.set(id, {
      name,
      imageUrl: imageUrlRaw || null,
      channel: normalizeChannel(channelRaw),
    })
  }

  return Object.fromEntries(
    [...out.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, value]) => [String(id), value])
  )
}

async function main(): Promise<void> {
  if (!SHEET_ID) {
    throw new Error("Missing BRANDS_SHEET_ID")
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  console.log(`Fetching sheet CSV: gid=${SHEET_GID}`)

  const response = await fetch(csvUrl, {
    headers: { Accept: "text/csv" },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet CSV (${response.status} ${response.statusText})`)
  }

  const csv = await response.text()
  if (!csv.trim()) {
    throw new Error("Sheet CSV response is empty")
  }

  const parsed = parseCsv(csv)
  const rows = toObjects(parsed)
  const snapshot = toSnapshot(rows)
  const total = Object.keys(snapshot).length

  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")

  console.log(`Saved ${total} brands to ${OUTPUT_PATH}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`sync-brands-from-google-sheet failed: ${message}`)
  process.exit(1)
})
