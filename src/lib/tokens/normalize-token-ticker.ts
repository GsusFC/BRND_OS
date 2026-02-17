export const TOKEN_TICKER_REGEX = /^[A-Z0-9]{2,10}$/
export const TOKEN_TICKER_VALIDATION_MESSAGE = "Invalid token ticker (use 2-10 chars, optional leading $)"

export const normalizeTokenTickerInput = (value: string | null | undefined): string => {
    if (typeof value !== "string") return ""
    return value.trim().replace(/^\$/, "").toUpperCase()
}

export const normalizeTokenTickerLoose = (value: string | null | undefined): string => {
    return normalizeTokenTickerInput(value).replace(/[^A-Z0-9]/g, "")
}
