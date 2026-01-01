import assert from "node:assert"
import * as fs from "node:fs/promises"
import * as path from "node:path"

type SnapshotObject = Record<string, unknown>

const readJsonFile = async (relativePath: string): Promise<unknown> => {
  const absolutePath = path.join(process.cwd(), relativePath)
  try {
    const contents = await fs.readFile(absolutePath, "utf8")
    return JSON.parse(contents) as unknown
  } catch (err) {
    const hint = `Missing S1 baseline snapshot file: ${relativePath}. Generate it with: npx tsx scripts/generate-s1-snapshot.ts (or scripts/generate-s1-snapshot-mysql2.ts).`

    if (err instanceof Error) {
      throw new Error(`${hint} Original error: ${err.message}`)
    }

    throw new Error(hint)
  }
}

const toNumberMap = (data: unknown, label: string): Map<number, number> => {
  assert(data && typeof data === "object" && !Array.isArray(data), `${label} snapshot must be an object`)

  const obj = data as SnapshotObject
  const map = new Map<number, number>()

  for (const [key, value] of Object.entries(obj)) {
    assert(/^[0-9]+$/.test(key), `${label} snapshot key must be numeric: ${key}`)
    assert(typeof value === "number" && Number.isFinite(value), `${label} snapshot value must be a finite number for key ${key}`)
    map.set(Number(key), value)
  }

  return map
}

let cachedUserPoints: Map<number, number> | null = null
let cachedBrandScore: Map<number, number> | null = null

export const getS1UserPointsMap = async (): Promise<Map<number, number>> => {
  if (cachedUserPoints) return cachedUserPoints

  const data = await readJsonFile("public/data/s1/users-points.json")
  cachedUserPoints = toNumberMap(data, "S1 users-points")
  return cachedUserPoints
}

export const getS1BrandScoreMap = async (): Promise<Map<number, number>> => {
  if (cachedBrandScore) return cachedBrandScore

  const data = await readJsonFile("public/data/s1/brands-score.json")
  cachedBrandScore = toNumberMap(data, "S1 brands-score")
  return cachedBrandScore
}

export const getS1UserPointsByFid = async (fid: number): Promise<number> => {
  assert(Number.isFinite(fid) && fid > 0, "fid must be a positive number")
  const map = await getS1UserPointsMap()
  return map.get(fid) ?? 0
}

export const getS1BrandScoreById = async (brandId: number): Promise<number> => {
  assert(Number.isFinite(brandId) && brandId > 0, "brandId must be a positive number")
  const map = await getS1BrandScoreMap()
  return map.get(brandId) ?? 0
}
