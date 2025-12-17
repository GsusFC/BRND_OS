/**
 * Enriquecimiento de usuarios del Indexer
 * Obtiene metadata (username, pfp) desde Neynar cache en MySQL
 */

import prisma from "@/lib/prisma"

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
  const cached = await prisma.farcasterUserCache.findUnique({
    where: { fid },
    select: {
      fid: true,
      username: true,
      displayName: true,
      pfpUrl: true,
    },
  })

  if (!cached) return null

  return {
    fid: cached.fid,
    username: cached.username,
    displayName: cached.displayName,
    pfpUrl: cached.pfpUrl,
  }
}

/**
 * Obtiene metadata de múltiples usuarios por FIDs
 */
export async function getUsersMetadata(fids: number[]): Promise<Map<number, UserMetadata>> {
  if (fids.length === 0) return new Map()

  const cached = await prisma.farcasterUserCache.findMany({
    where: { fid: { in: fids } },
    select: {
      fid: true,
      username: true,
      displayName: true,
      pfpUrl: true,
    },
  })

  return new Map(
    cached.map((u) => [
      u.fid,
      {
        fid: u.fid,
        username: u.username,
        displayName: u.displayName,
        pfpUrl: u.pfpUrl,
      },
    ])
  )
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
