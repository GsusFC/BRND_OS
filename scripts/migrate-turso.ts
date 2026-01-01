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

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_leaderboard_brands_alltime_points ON leaderboard_brands_alltime (allTimePoints)"
    )

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
