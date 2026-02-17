export const TOKEN_CONTRACT_ADDRESS_REGEX = /^[^\s]{3,128}$/
export const TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE =
  "Invalid token contract address (3-128 chars, no spaces)."

export const normalizeTokenContractAddressInput = (value: unknown): string => {
  if (typeof value !== "string") return ""
  return value.trim()
}

export const isValidTokenContractAddress = (value: string): boolean =>
  value.length === 0 || TOKEN_CONTRACT_ADDRESS_REGEX.test(value)
