/**
 * Season Types - Modelo estilo F1
 * - Season = Temporada completa (múltiples rounds/semanas)
 * - Round = Semana individual (lunes-domingo)
 */

export type DataSource = 'mysql' | 'indexer'

export interface Season {
  id: number
  name: string
  startAt: Date
  endAt: Date | null // null = en curso
  totalRounds: number
  dataSource: DataSource
}

export interface Round {
  seasonId: number
  roundNumber: number
  startAt: Date
  endAt: Date
  status: 'upcoming' | 'active' | 'completed'
}

export interface SeasonWithRounds extends Season {
  rounds: Round[]
  currentRound: Round | null
}
