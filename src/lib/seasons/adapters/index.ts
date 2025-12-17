/**
 * Season Adapters - Factory para seleccionar el adaptador correcto
 */

import { SeasonRegistry } from "../registry"
import type { SeasonAdapter } from "./types"
import { MySQLAdapter } from "./mysql"
import { IndexerAdapter } from "./indexer"

export * from "./types"

/**
 * Obtiene el adaptador para una season específica
 */
export function getAdapterForSeason(seasonId: number): SeasonAdapter {
  const season = SeasonRegistry.getSeasonById(seasonId)
  
  if (!season) {
    throw new Error(`Season ${seasonId} not found`)
  }

  switch (season.dataSource) {
    case "mysql":
      return MySQLAdapter
    case "indexer":
      return IndexerAdapter
    default:
      throw new Error(`Unknown data source: ${season.dataSource}`)
  }
}

/**
 * Obtiene el adaptador para la season activa
 */
export function getActiveAdapter(): SeasonAdapter {
  const activeSeason = SeasonRegistry.getActiveSeason()
  
  if (!activeSeason) {
    throw new Error("No active season found")
  }

  return getAdapterForSeason(activeSeason.id)
}

/**
 * Shortcut: Obtiene el leaderboard de brands de la season activa
 */
export async function getWeeklyBrandLeaderboard(limit?: number) {
  return getActiveAdapter().getWeeklyBrandLeaderboard(limit)
}

/**
 * Shortcut: Obtiene los podiums recientes de la season activa
 */
export async function getRecentPodiums(limit?: number) {
  return getActiveAdapter().getRecentPodiums(limit)
}

/**
 * Shortcut: Obtiene el leaderboard de usuarios de la season activa
 */
export async function getUserLeaderboard(limit?: number) {
  return getActiveAdapter().getUserLeaderboard(limit)
}

export { MySQLAdapter, IndexerAdapter }
export { getIndexerStats } from "./indexer-stats"
export type { IndexerStats } from "./indexer-stats"
export { getIndexerUsers, getIndexerUserByFid } from "./indexer-users"
export type { IndexerUser, IndexerUsersResult } from "./indexer-users"
