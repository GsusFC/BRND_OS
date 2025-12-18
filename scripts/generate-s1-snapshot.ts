/**
 * Script para generar el snapshot estático de Season 1
 * Ejecutar: npx tsx scripts/generate-s1-snapshot.ts
 * 
 * Output: public/data/s1/
 *   - meta.json
 *   - summary.json
 *   - timeseries.json
 *   - toplists.json
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

// Add connection_limit=1 to avoid overwhelming MySQL
const dbUrl = process.env.MYSQL_DATABASE_URL
if (!dbUrl) {
  throw new Error("MYSQL_DATABASE_URL is required to generate the S1 snapshot")
}
const urlWithLimit = dbUrl.includes("?") 
  ? `${dbUrl}&connection_limit=1` 
  : `${dbUrl}?connection_limit=1`

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: urlWithLimit,
    },
  },
})

const CUTOFF_DAY = "2025-12-11"
const FIRST_S2_DAY = "2025-12-12"
const TOP_N = 20
const OUTPUT_DIR = path.join(process.cwd(), "public/data/s1")

interface S1Meta {
  version: string
  generatedAt: string
  cutoffDay: string
  firstS2Day: string
  topN: { brands: number; users: number }
}

interface S1Summary {
  totalUsers: number
  totalBrands: number
  totalPodiums: number
  totalVotes: number
  dateRange: { from: string; to: string }
}

interface TimeseriesEntry {
  day: string
  count: number
}

interface S1Timeseries {
  votesPerDay: TimeseriesEntry[]
  activeUsersPerWeek: Array<{ weekStart: string; count: number }>
}

interface TopBrand {
  brandId: number
  name: string
  imageUrl: string | null
  channel: string | null
  gold: number
  silver: number
  bronze: number
  totalVotes: number
  score: number
}

interface TopUser {
  odiumId: number
  fid: number | null
  username: string
  photoUrl: string | null
  totalVotes: number
  points: number
}

interface S1UserPointsSnapshot {
  [fid: string]: number
}

interface S1BrandScoresSnapshot {
  [brandId: string]: number
}

interface S1Toplists {
  topBrandsAllTime: TopBrand[]
  topUsersAllTime: TopUser[]
  categoryDistribution: Array<{ name: string; brandCount: number; voteCount: number }>
}

async function generateBaselineSnapshots(): Promise<{
  usersPoints: S1UserPointsSnapshot
  brandsScore: S1BrandScoresSnapshot
}> {
  const users = await prisma.user.findMany({
    select: {
      fid: true,
      points: true,
    },
  })

  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      score: true,
    },
  })

  const usersPoints: S1UserPointsSnapshot = {}
  for (const user of users) {
    usersPoints[String(user.fid)] = user.points ?? 0
  }

  const brandsScore: S1BrandScoresSnapshot = {}
  for (const brand of brands) {
    brandsScore[String(brand.id)] = brand.score ?? 0
  }

  return { usersPoints, brandsScore }
}

async function generateMeta(): Promise<S1Meta> {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    cutoffDay: CUTOFF_DAY,
    firstS2Day: FIRST_S2_DAY,
    topN: { brands: TOP_N, users: TOP_N },
  }
}

async function generateSummary(): Promise<S1Summary> {
  const cutoffDate = new Date(CUTOFF_DAY + "T23:59:59.999Z")

  // Sequential queries to avoid too many connections
  const totalUsers = await prisma.user.count()
  const totalBrands = await prisma.brand.count({ where: { banned: 0 } })
  const totalPodiums = await prisma.userBrandVote.count({ where: { date: { lte: cutoffDate } } })
  const firstVote = await prisma.userBrandVote.findFirst({ orderBy: { date: "asc" }, select: { date: true } })
  const lastVote = await prisma.userBrandVote.findFirst({ where: { date: { lte: cutoffDate } }, orderBy: { date: "desc" }, select: { date: true } })

  return {
    totalUsers,
    totalBrands,
    totalPodiums,
    totalVotes: totalPodiums * 3,
    dateRange: {
      from: firstVote?.date?.toISOString().split("T")[0] ?? "unknown",
      to: lastVote?.date?.toISOString().split("T")[0] ?? CUTOFF_DAY,
    },
  }
}

async function generateTimeseries(): Promise<S1Timeseries> {
  const cutoffDate = new Date(CUTOFF_DAY + "T23:59:59.999Z")

  // Votes per day
  const votesPerDayRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT DATE(date) as date, COUNT(*) as count
    FROM user_brand_votes
    WHERE date <= ${cutoffDate}
    GROUP BY DATE(date)
    ORDER BY date ASC
  `

  const votesPerDay: TimeseriesEntry[] = votesPerDayRaw.map((r) => ({
    day: r.date.toISOString().split("T")[0],
    count: Number(r.count),
  }))

  // Active users per week (ISO week)
  const activeUsersRaw = await prisma.$queryRaw<Array<{ weekStart: Date; count: bigint }>>`
    SELECT DATE(DATE_SUB(date, INTERVAL WEEKDAY(date) DAY)) as weekStart, COUNT(DISTINCT userId) as count
    FROM user_brand_votes
    WHERE date <= ${cutoffDate}
    GROUP BY weekStart
    ORDER BY weekStart ASC
  `

  const activeUsersPerWeek = activeUsersRaw.map((r) => ({
    weekStart: r.weekStart.toISOString().split("T")[0],
    count: Number(r.count),
  }))

  return { votesPerDay, activeUsersPerWeek }
}

async function generateToplists(): Promise<S1Toplists> {
  const cutoffDate = new Date(CUTOFF_DAY + "T23:59:59.999Z")

  // Top 20 brands by score (all-time up to cutoff)
  const topBrandsRaw = await prisma.brand.findMany({
    where: { banned: 0 },
    orderBy: { score: "desc" },
    take: TOP_N,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      channel: true,
      score: true,
    },
  })

  // Get vote counts for each brand (sequential to avoid connection overload)
  const topBrandsWithVotes: TopBrand[] = []
  for (const brand of topBrandsRaw) {
    const gold = await prisma.userBrandVote.count({ where: { brand1Id: brand.id, date: { lte: cutoffDate } } })
    const silver = await prisma.userBrandVote.count({ where: { brand2Id: brand.id, date: { lte: cutoffDate } } })
    const bronze = await prisma.userBrandVote.count({ where: { brand3Id: brand.id, date: { lte: cutoffDate } } })

    topBrandsWithVotes.push({
      brandId: brand.id,
      name: brand.name,
      imageUrl: brand.imageUrl,
      channel: brand.channel,
      gold,
      silver,
      bronze,
      totalVotes: gold + silver + bronze,
      score: brand.score ?? 0,
    })
  }

  // Top 20 users by points
  const topUsersRaw = await prisma.user.findMany({
    orderBy: { points: "desc" },
    take: TOP_N,
    select: {
      id: true,
      fid: true,
      username: true,
      photoUrl: true,
      points: true,
    },
  })

  // Get vote count for each user (sequential)
  const topUsersWithVotes: TopUser[] = []
  for (const user of topUsersRaw) {
    const totalVotes = await prisma.userBrandVote.count({
      where: { userId: user.id, date: { lte: cutoffDate } },
    })

    topUsersWithVotes.push({
      odiumId: user.id,
      fid: user.fid,
      username: user.username,
      photoUrl: user.photoUrl,
      totalVotes,
      points: user.points ?? 0,
    })
  }

  // Category distribution
  const categoryDistRaw = await prisma.$queryRaw<Array<{ name: string; brandCount: bigint; voteCount: bigint }>>`
    SELECT 
      c.name,
      COUNT(DISTINCT b.id) as brandCount,
      (
        SELECT COUNT(*)
        FROM user_brand_votes v
        WHERE v.date <= ${cutoffDate}
        AND (v.brand1Id IN (SELECT id FROM brands WHERE categoryId = c.id)
          OR v.brand2Id IN (SELECT id FROM brands WHERE categoryId = c.id)
          OR v.brand3Id IN (SELECT id FROM brands WHERE categoryId = c.id))
      ) as voteCount
    FROM categories c
    LEFT JOIN brands b ON b.categoryId = c.id AND b.banned = 0
    GROUP BY c.id, c.name
    HAVING brandCount > 0
    ORDER BY voteCount DESC
  `

  const categoryDistribution = categoryDistRaw.map((r) => ({
    name: r.name,
    brandCount: Number(r.brandCount),
    voteCount: Number(r.voteCount),
  }))

  return {
    topBrandsAllTime: topBrandsWithVotes,
    topUsersAllTime: topUsersWithVotes,
    categoryDistribution,
  }
}

async function main() {
  console.log("🚀 Generating S1 Snapshot...")
  console.log(`   cutoffDay: ${CUTOFF_DAY}`)
  console.log(`   outputDir: ${OUTPUT_DIR}`)

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Generate all data
  console.log("\n📊 Generating meta...")
  const meta = await generateMeta()
  fs.writeFileSync(path.join(OUTPUT_DIR, "meta.json"), JSON.stringify(meta, null, 2))
  console.log("   ✓ meta.json")

  console.log("\n📊 Generating summary...")
  const summary = await generateSummary()
  fs.writeFileSync(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2))
  console.log("   ✓ summary.json")
  console.log(`   - ${summary.totalUsers.toLocaleString()} users`)
  console.log(`   - ${summary.totalBrands.toLocaleString()} brands`)
  console.log(`   - ${summary.totalPodiums.toLocaleString()} podiums`)

  console.log("\n📊 Generating timeseries...")
  const timeseries = await generateTimeseries()
  fs.writeFileSync(path.join(OUTPUT_DIR, "timeseries.json"), JSON.stringify(timeseries, null, 2))
  console.log("   ✓ timeseries.json")
  console.log(`   - ${timeseries.votesPerDay.length} days of votes`)
  console.log(`   - ${timeseries.activeUsersPerWeek.length} weeks of active users`)

  console.log("\n📊 Generating toplists...")
  const toplists = await generateToplists()
  fs.writeFileSync(path.join(OUTPUT_DIR, "toplists.json"), JSON.stringify(toplists, null, 2))
  console.log("   ✓ toplists.json")
  console.log(`   - Top ${toplists.topBrandsAllTime.length} brands`)
  console.log(`   - Top ${toplists.topUsersAllTime.length} users`)
  console.log(`   - ${toplists.categoryDistribution.length} categories`)

  console.log("\n📊 Generating baseline snapshots...")
  const baseline = await generateBaselineSnapshots()
  fs.writeFileSync(path.join(OUTPUT_DIR, "users-points.json"), JSON.stringify(baseline.usersPoints, null, 2))
  console.log("   ✓ users-points.json")
  fs.writeFileSync(path.join(OUTPUT_DIR, "brands-score.json"), JSON.stringify(baseline.brandsScore, null, 2))
  console.log("   ✓ brands-score.json")

  console.log("\n✅ S1 Snapshot generated successfully!")
  console.log(`   Files: ${OUTPUT_DIR}/`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Error generating snapshot:", e)
  prisma.$disconnect()
  process.exit(1)
})
