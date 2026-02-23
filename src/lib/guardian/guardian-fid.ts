export const normalizeGuardianFid = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) return null
    return parsed
}

export const firstGuardianFid = (...values: unknown[]): number | null => {
    for (const value of values) {
        const normalized = normalizeGuardianFid(value)
        if (normalized) return normalized
    }
    return null
}

