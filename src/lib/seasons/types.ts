
/**
 * Season Types - Modelo estilo F1
 * - Season = Temporada completa (múltiples rounds/semanas)
 * - Round = Semana individual (lunes-domingo)
 */

export type DataSource = 'mysql' | 'indexer'

export interface LeaderboardBrand {
  id: number
  name: string
  imageUrl: string | null
  channel: string | null
  points: number
  gold: number
  silver: number
  bronze: number
  totalVotes: number
  rank: number
}

export interface LeaderboardResponse {
  data: LeaderboardBrand[]
  updatedAt: Date
  seasonId: number
  roundNumber: number | null
}

export interface PodiumVote {
  id: string
  date: Date
  fid: number
  username: string | null
  userPhoto: string | null
  brandIds: number[]
  transactionHash?: string
}

export interface PodiumsResponse {
  data: PodiumVote[]
  seasonId: number
  roundNumber?: number | null
  updatedAt: Date
}

export interface UserRanking {
  fid: number
  username: string | null
  photoUrl: string | null
  points: number
  totalVotes: number
  rank: number
}

export interface UserLeaderboardResponse {
  data: UserRanking[]
  seasonId: number
  roundNumber?: number | null
  updatedAt: Date
}

export interface SeasonAdapter {
  getWeeklyBrandLeaderboard(limit?: number, round?: number): Promise<LeaderboardResponse>
  getLiveWeeklyLeaderboard?(limit?: number, round?: number): Promise<LeaderboardResponse>
  getRecentPodiums(limit?: number): Promise<PodiumsResponse>
  getUserLeaderboard(limit?: number): Promise<UserLeaderboardResponse>
  getAvailableRounds?(): Promise<{ round: number; label: string; isCurrent: boolean }[]>
}

export interface Season {
  id: number
  name: string
  startAt: Date
  endAt: Date | null // null = en curso
  totalRounds: number
  dataSource: DataSource
  adapter: SeasonAdapter
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
