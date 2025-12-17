/**
 * Tipos comunes para adaptadores season-aware
 * Interfaz unificada para datos de S1 (MySQL) y S2 (Indexer)
 */

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
  seasonId: number
  roundNumber: number | null
  updatedAt: string
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
  updatedAt: string
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
  updatedAt: string
}

export interface SeasonAdapter {
  getWeeklyBrandLeaderboard(limit?: number): Promise<LeaderboardResponse>
  getRecentPodiums(limit?: number): Promise<PodiumsResponse>
  getUserLeaderboard(limit?: number): Promise<UserLeaderboardResponse>
}
