export const normalizeImageSrc = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

export const isHttpImageSrc = (src: string): boolean => {
  try {
    const url = new URL(src)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export const isInlineImageSrc = (src: string): boolean => /^data:image\//i.test(src) || /^blob:/i.test(src)

export const canRenderImageSrc = (value: string | null | undefined): value is string => {
  const normalized = normalizeImageSrc(value)
  if (!normalized) return false
  return isHttpImageSrc(normalized) || isInlineImageSrc(normalized)
}
