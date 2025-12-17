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
 * Graceful degradation: devuelve lo que pueda, sin fallar
 */
export async function getUsersMetadata(fids: number[]): Promise<Map<number, UserMetadata>> {
  if (fids.length === 0) return new Map()

  const result = new Map<number, UserMetadata>()

  try {
    const profiles = await getProfilesByFids(fids)

    for (const p of profiles) {
      result.set(p.fid, {
        fid: p.fid,
        username: p.username,
        displayName: p.name,
        pfpUrl: p.imageUrl,
      })
    }
  } catch (error) {
    // Log but don't fail - users will show as "FID X" instead
    console.warn("[getUsersMetadata] Could not fetch profiles:", error instanceof Error ? error.message : error)
  }

  return result
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
