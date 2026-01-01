/**
 * Season Context Helper
 * Detecta seasonId y basePath desde el pathname de la URL
 */

export interface SeasonContext {
  seasonId: 1 | 2
  basePath: string
  isLegacy: boolean
}

/**
 * Extrae el contexto de season desde un pathname
 * - /dashboard/season-1/* → seasonId=1, basePath="/dashboard/season-1", isLegacy=true
 * - /dashboard/* → seasonId=2, basePath="/dashboard", isLegacy=false
 */
export function getSeasonContext(pathname: string): SeasonContext {
  const isLegacy = pathname.startsWith("/dashboard/season-1")
  
  return {
    seasonId: isLegacy ? 1 : 2,
    basePath: isLegacy ? "/dashboard/season-1" : "/dashboard",
    isLegacy,
  }
}

/**
 * Construye una URL relativa al basePath actual
 */
export function buildSeasonUrl(basePath: string, path: string): string {
  // Evitar doble slash
  const cleanPath = path.startsWith("/") ? path.slice(1) : path
  return `${basePath}/${cleanPath}`
}

/**
 * Hook helper para usar en Server Components
 * Recibe headers() y extrae el pathname del referer o x-pathname
 */
export function getSeasonContextFromHeaders(headersList: Headers): SeasonContext {
  const pathname = headersList.get("x-pathname") || headersList.get("referer") || "/dashboard"
  return getSeasonContext(pathname)
}
