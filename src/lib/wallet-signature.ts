import { getAddress, verifyMessage } from "viem"

export const WALLET_SIGNATURE_NONCE_PREFIX = "brnd:wallet:nonce"
export const WALLET_SIGNATURE_TTL_SECONDS = 5 * 60

type WalletSignaturePayload = {
    address: string
    nonce: string
    expiresAt: number
    origin: string
}

export const normalizeWalletAddress = (address: string) => getAddress(address)

export const buildWalletNonceKey = (address: string, nonce: string) => {
    const normalizedAddress = normalizeWalletAddress(address)
    return `${WALLET_SIGNATURE_NONCE_PREFIX}:${normalizedAddress}:${nonce}`
}

export const buildWalletSignatureMessage = ({
    address,
    nonce,
    expiresAt,
    origin,
}: WalletSignaturePayload) => {
    if (!nonce) {
        throw new Error("Nonce is required")
    }

    if (!origin) {
        throw new Error("Origin is required")
    }

    if (!Number.isFinite(expiresAt)) {
        throw new Error("ExpiresAt must be a valid timestamp")
    }

    const normalizedAddress = normalizeWalletAddress(address)
    const expiresIso = new Date(expiresAt).toISOString()

    return [
        "BRND Wallet Verification",
        `Domain: ${origin}`,
        `Address: ${normalizedAddress}`,
        `Nonce: ${nonce}`,
        `Expires At: ${expiresIso}`,
        "I confirm ownership of this wallet to submit a BRND application.",
    ].join("\n")
}

export const verifyWalletSignature = async ({
    address,
    nonce,
    expiresAt,
    origin,
    signature,
}: WalletSignaturePayload & { signature: string }) => {
    const message = buildWalletSignatureMessage({
        address,
        nonce,
        expiresAt,
        origin,
    })

    return verifyMessage({
        address: normalizeWalletAddress(address),
        message,
        signature: signature as `0x${string}`,
    })
}
