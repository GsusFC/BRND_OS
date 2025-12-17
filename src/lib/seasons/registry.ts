/**
 * SeasonRegistry - Configuración estática de seasons
 * 
 * Rounds = Semanas (lunes 00:00 UTC - domingo 23:59:59 UTC)
 * Similar a temporadas de F1
 */

import type { Season, Round, SeasonWithRounds, DataSource } from './types'

// Season 2 start: primer voto del indexer
const SEASON_2_START = new Date('2025-12-12T18:12:37.000Z')

// Configuración estática de seasons
const SEASONS_CONFIG: Season[] = [
  {
    id: 1,
    name: 'Season 1',
    startAt: new Date('2024-01-01T00:00:00.000Z'), // TODO: confirmar fecha real
    endAt: new Date('2025-12-12T00:00:00.000Z'),   // Antes de Season 2
    totalRounds: 26,
    dataSource: 'mysql',
  },
  {
    id: 2,
    name: 'Season 2',
    startAt: SEASON_2_START,
    endAt: null, // En curso
    totalRounds: 26,
    dataSource: 'indexer',
  },
]

/**
 * Calcula el inicio de la semana (lunes 00:00 UTC) para una fecha dada
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day // Lunes = 1, Domingo = 0 -> -6
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Calcula el fin de la semana (domingo 23:59:59.999 UTC) para una fecha dada
 */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

/**
 * Genera los rounds (semanas) para una season
 */
function generateRounds(season: Season, now: Date = new Date()): Round[] {
  const rounds: Round[] = []
  const seasonStart = getWeekStart(season.startAt)
  
  for (let i = 0; i < season.totalRounds; i++) {
    const roundStart = new Date(seasonStart)
    roundStart.setUTCDate(roundStart.getUTCDate() + (i * 7))
    
    const roundEnd = getWeekEnd(roundStart)
    
    let status: Round['status'] = 'upcoming'
    if (now > roundEnd) {
      status = 'completed'
    } else if (now >= roundStart && now <= roundEnd) {
      status = 'active'
    }
    
    // Si la season terminó, todos los rounds están completed
    if (season.endAt && now > season.endAt) {
      status = 'completed'
    }
    
    rounds.push({
      seasonId: season.id,
      roundNumber: i + 1,
      startAt: roundStart,
      endAt: roundEnd,
      status,
    })
  }
  
  return rounds
}

/**
 * SeasonRegistry - Acceso a configuración de seasons
 */
export const SeasonRegistry = {
  /**
   * Obtiene todas las seasons configuradas
   */
  getAllSeasons(): Season[] {
    return SEASONS_CONFIG
  },

  /**
   * Obtiene una season por ID
   */
  getSeasonById(id: number): Season | null {
    return SEASONS_CONFIG.find(s => s.id === id) ?? null
  },

  /**
   * Obtiene la season activa (en curso)
   */
  getActiveSeason(): Season | null {
    const now = new Date()
    return SEASONS_CONFIG.find(s => {
      const started = now >= s.startAt
      const notEnded = s.endAt === null || now <= s.endAt
      return started && notEnded
    }) ?? null
  },

  /**
   * Obtiene una season con sus rounds generados
   */
  getSeasonWithRounds(seasonId: number, now: Date = new Date()): SeasonWithRounds | null {
    const season = this.getSeasonById(seasonId)
    if (!season) return null

    const rounds = generateRounds(season, now)
    const currentRound = rounds.find(r => r.status === 'active') ?? null

    return {
      ...season,
      rounds,
      currentRound,
    }
  },

  /**
   * Obtiene el round actual de la season activa
   */
  getCurrentRound(): Round | null {
    const activeSeason = this.getActiveSeason()
    if (!activeSeason) return null

    const seasonWithRounds = this.getSeasonWithRounds(activeSeason.id)
    return seasonWithRounds?.currentRound ?? null
  },

  /**
   * Obtiene el número de round actual (1-indexed)
   */
  getCurrentRoundNumber(): number | null {
    return this.getCurrentRound()?.roundNumber ?? null
  },

  /**
   * Obtiene el data source para una season
   */
  getDataSource(seasonId: number): DataSource | null {
    return this.getSeasonById(seasonId)?.dataSource ?? null
  },

  /**
   * Obtiene el data source de la season activa
   */
  getActiveDataSource(): DataSource | null {
    return this.getActiveSeason()?.dataSource ?? null
  },
}

export default SeasonRegistry
