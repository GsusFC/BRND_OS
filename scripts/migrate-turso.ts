import dotenv from "dotenv"
import path from "path"

// Load .env.local if it exists
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
// Fallback to .env
dotenv.config()

import turso from "../src/lib/turso"

async function main() {
  console.log("🐘 Starting Turso Migration...")

  try {
    console.log("Running migration: Brands & Categories Tables...")
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT,
        warpcastUrl TEXT,
        description TEXT,
        categoryId INTEGER,
        imageUrl TEXT,
        walletAddress TEXT,
        ownerFid INTEGER,
        ownerPrimaryWallet TEXT,
        ownerWalletFid INTEGER,
        channel TEXT,
        profile TEXT,
        tokenContractAddress TEXT,
        tokenTicker TEXT,
        queryType INTEGER,
        followerCount INTEGER,
        banned INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const categoriesInfo = await turso.execute("PRAGMA table_info(categories)")
    const categoryColumns = new Set(categoriesInfo.rows.map((r) => String(r.name)))
    if (!categoryColumns.has("createdAt")) {
      await turso.execute("ALTER TABLE categories ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP")
    }
    if (!categoryColumns.has("updatedAt")) {
      await turso.execute("ALTER TABLE categories ADD COLUMN updatedAt TEXT DEFAULT CURRENT_TIMESTAMP")
    }

    const brandsInfo = await turso.execute("PRAGMA table_info(brands)")
    const brandColumns = new Set(brandsInfo.rows.map((r) => String(r.name)))
    if (!brandColumns.has("url")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN url TEXT")
    }
    if (!brandColumns.has("warpcastUrl")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN warpcastUrl TEXT")
    }
    if (!brandColumns.has("description")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN description TEXT")
    }
    if (!brandColumns.has("categoryId")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN categoryId INTEGER")
    }
    if (!brandColumns.has("imageUrl")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN imageUrl TEXT")
    }
    if (!brandColumns.has("walletAddress")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN walletAddress TEXT")
    }
    if (!brandColumns.has("ownerFid")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN ownerFid INTEGER")
    }
    if (!brandColumns.has("ownerPrimaryWallet")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN ownerPrimaryWallet TEXT")
    }
    if (!brandColumns.has("ownerWalletFid")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN ownerWalletFid INTEGER")
    }
    if (!brandColumns.has("channel")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN channel TEXT")
    }
    if (!brandColumns.has("profile")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN profile TEXT")
    }
    if (!brandColumns.has("tokenContractAddress")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN tokenContractAddress TEXT")
    }
    if (!brandColumns.has("tokenTicker")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN tokenTicker TEXT")
    }
    if (!brandColumns.has("queryType")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN queryType INTEGER")
    }
    if (!brandColumns.has("followerCount")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN followerCount INTEGER")
    }
    if (!brandColumns.has("banned")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN banned INTEGER NOT NULL DEFAULT 0")
    }
    if (!brandColumns.has("createdAt")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP")
    }
    if (!brandColumns.has("updatedAt")) {
      await turso.execute("ALTER TABLE brands ADD COLUMN updatedAt TEXT DEFAULT CURRENT_TIMESTAMP")
    }
    console.log(" - brands/categories created/verified")

    // 1. Metrics Tables
    console.log("Running migration: Metrics Tables...")
    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS metrics_latency_1m (
          bucketStartMs INTEGER NOT NULL,
          name TEXT NOT NULL,
          count INTEGER NOT NULL,
          errorCount INTEGER NOT NULL,
          sumMs REAL NOT NULL,
          maxMs REAL NOT NULL,
          b0 INTEGER NOT NULL,
          b1 INTEGER NOT NULL,
          b2 INTEGER NOT NULL,
          b3 INTEGER NOT NULL,
          b4 INTEGER NOT NULL,
          b5 INTEGER NOT NULL,
          b6 INTEGER NOT NULL,
          b7 INTEGER NOT NULL,
          b8 INTEGER NOT NULL,
          b9 INTEGER NOT NULL,
          b10 INTEGER NOT NULL,
          b11 INTEGER NOT NULL,
          b12 INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL,
          PRIMARY KEY(bucketStartMs, name)
        )
      `)
      console.log(" - metrics_latency_1m created/verified")
    } catch (e: unknown) {
      console.error("Failed to create metrics_latency_1m:", e instanceof Error ? e.message : String(e))
      throw e
    }

    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS metrics_counter_1m (
          bucketStartMs INTEGER NOT NULL,
          name TEXT NOT NULL,
          count INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL,
          PRIMARY KEY(bucketStartMs, name)
        )
      `)
      console.log(" - metrics_counter_1m created/verified")
    } catch (e: unknown) {
      console.error("Failed to create metrics_counter_1m:", e instanceof Error ? e.message : String(e))
      throw e
    }

    // 2. Farcaster Cache Tables
    console.log("Running migration: Farcaster Cache Tables...")
    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS farcaster_user_cache (
          fid INTEGER PRIMARY KEY,
          username TEXT,
          displayName TEXT,
          pfpUrl TEXT,
          data TEXT NOT NULL,
          fetchedAtMs INTEGER NOT NULL,
          expiresAtMs INTEGER NOT NULL,
          createdAtMs INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        )
      `)
      console.log(" - farcaster_user_cache created/verified")
    } catch (e: unknown) {
      console.error("Failed to create farcaster_user_cache:", e instanceof Error ? e.message : String(e))
      throw e
    }

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_farcaster_user_cache_username ON farcaster_user_cache (username)"
    )
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_farcaster_user_cache_expiresAtMs ON farcaster_user_cache (expiresAtMs)"
    )

    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS farcaster_channel_cache (
          channelId TEXT PRIMARY KEY,
          name TEXT,
          url TEXT,
          imageUrl TEXT,
          data TEXT NOT NULL,
          fetchedAtMs INTEGER NOT NULL,
          expiresAtMs INTEGER NOT NULL,
          createdAtMs INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        )
      `)
      console.log(" - farcaster_channel_cache created/verified")
    } catch (e: unknown) {
      console.error("Failed to create farcaster_channel_cache:", e instanceof Error ? e.message : String(e))
      throw e
    }

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_farcaster_channel_cache_expiresAtMs ON farcaster_channel_cache (expiresAtMs)"
    )

    // 3. Leaderboard Materialization Tables
    console.log("Running migration: Leaderboard Materialization Tables...")
    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS leaderboard_materialization_meta (
          key TEXT PRIMARY KEY,
          expiresAtMs INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        )
      `)
      console.log(" - leaderboard_materialization_meta created/verified")
    } catch (e: unknown) {
      console.error("Failed to create leaderboard_materialization_meta:", e instanceof Error ? e.message : String(e))
      throw e
    }

    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS leaderboard_brands_alltime (
          brandId INTEGER PRIMARY KEY,
          allTimePoints REAL NOT NULL,
          pointsS1 REAL NOT NULL,
          pointsS2 REAL NOT NULL,
          goldCount INTEGER NOT NULL,
          silverCount INTEGER NOT NULL,
          bronzeCount INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        )
      `)
      console.log(" - leaderboard_brands_alltime created/verified")
    } catch (e: unknown) {
      console.error("Failed to create leaderboard_brands_alltime:", e instanceof Error ? e.message : String(e))
      throw e
    }

    // Create indices for sorting columns
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_leaderboard_brands_alltime_points ON leaderboard_brands_alltime (allTimePoints DESC)"
    )
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_leaderboard_brands_alltime_gold ON leaderboard_brands_alltime (goldCount DESC)"
    )
    console.log(" - leaderboard_brands_alltime indices created")

    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS leaderboard_users_alltime (
          fid INTEGER PRIMARY KEY,
          points REAL NOT NULL,
          pointsS1 REAL NOT NULL,
          pointsS2 REAL NOT NULL,
          updatedAtMs INTEGER NOT NULL
        )
      `)
      console.log(" - leaderboard_users_alltime created/verified")
    } catch (e: unknown) {
      console.error("Failed to create leaderboard_users_alltime:", e instanceof Error ? e.message : String(e))
      throw e
    }

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_leaderboard_users_alltime_points ON leaderboard_users_alltime (points)"
    )

    console.log("✅ Turso Migration Complete!")
  } catch (error: unknown) {
    console.error("❌ Migration Failed:", error)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("❌ Unhandled Error:", e)
  process.exit(1)
})
