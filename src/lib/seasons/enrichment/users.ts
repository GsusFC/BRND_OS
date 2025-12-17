/**
 * Enriquecimiento de usuarios del Indexer
 * Obtiene metadata (username, pfp) desde Turso cache (Farcaster/Neynar)
 */

import { getProfilesByFids } from "@/lib/farcaster-profile-cache"

export interface UserMetadata {
  fid: number
  username: string | null
  displayName: string | null
  pfpUrl: string | null
}

/**
 * Obtiene metadata de un usuario por FID desde cache
 */
export async function getUserMetadata(fid: number): Promise<UserMetadata | null> {
  try {
    const profiles = await getProfilesByFids([fid])
    if (profiles.length === 0) return null

    const profile = profiles[0]
    return {
      fid: profile.fid,
      username: profile.username,
      displayName: profile.name,
      pfpUrl: profile.imageUrl,
    }
  } catch {
    return null
  }
}

/**
 * Obtiene metadata de múltiples usuarios por FIDs
 */
export async function getUsersMetadata(fids: number[]): Promise<Map<number, UserMetadata>> {
  if (fids.length === 0) return new Map()

  try {
    const profiles = await getProfilesByFids(fids)

    return new Map(
      profiles.map((p) => [
        p.fid,
        {
          fid: p.fid,
          username: p.username,
          displayName: p.name,
          pfpUrl: p.imageUrl,
        },
      ])
    )
  } catch {
    // Return empty map on error - graceful degradation
    return new Map()
  }
}

/**
 * Enriquece un array de objetos que tienen fid con metadata de usuario
 */
export async function enrichWithUserMetadata<T extends { fid: number }>(
  items: T[]
): Promise<(T & { username: string | null; userPhoto: string | null })[]> {
  const fids = items.map((item) => item.fid)
  const metadata = await getUsersMetadata(fids)

  return items.map((item) => {
    const user = metadata.get(item.fid)
    return {
      ...item,
      username: user?.username ?? user?.displayName ?? null,
      userPhoto: user?.pfpUrl ?? null,
    }
  })
}
