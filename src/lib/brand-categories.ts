export const CANONICAL_CATEGORY_NAMES = [
  "DeFi",
  "NFT",
  "Infrastructure",
  "Social",
  "Gaming",
  "DAO",
  "Wallet",
  "L2",
  "Other",
] as const

export type CanonicalCategoryName = (typeof CANONICAL_CATEGORY_NAMES)[number]

type NamedCategory = {
  name: string
}

export const getMissingCanonicalCategories = (
  categories: NamedCategory[]
): CanonicalCategoryName[] => {
  const present = new Set(categories.map((c) => c.name))
  return CANONICAL_CATEGORY_NAMES.filter((name) => !present.has(name))
}

export const sortCategoriesByCanonicalOrder = <T extends NamedCategory>(
  categories: T[]
): T[] => {
  const order = new Map<string, number>(
    CANONICAL_CATEGORY_NAMES.map((name, index) => [name, index])
  )

  return [...categories].sort((a, b) => {
    const aIndex = order.get(a.name) ?? Number.POSITIVE_INFINITY
    const bIndex = order.get(b.name) ?? Number.POSITIVE_INFINITY
    return aIndex - bIndex
  })
}
