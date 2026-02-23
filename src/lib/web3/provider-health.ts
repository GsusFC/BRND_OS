import type { Connector } from "wagmi"

const isWalletConnectSessionInvalid = (message: string) => {
    const normalized = message.toLowerCase()
    return (
        normalized.includes("without any listeners") ||
        normalized.includes("session_request") ||
        normalized.includes("message channel closed") ||
        normalized.includes("walletconnect")
    )
}

const isProviderNotFound = (name: string, message: string) => {
    const normalized = message.toLowerCase()
    return (
        name === "ProviderNotFoundError" ||
        normalized.includes("provider not found")
    )
}

export function getWalletProviderUserMessage(error: unknown, connectorId?: string) {
    const err = error as {
        name?: string
        message?: string
        code?: number
        cause?: { name?: string; message?: string; code?: number }
    } | null

    const name = err?.name || err?.cause?.name || ""
    const message = err?.message || err?.cause?.message || ""

    if (isProviderNotFound(name, message)) {
        return "No hay provider activo para este conector. Reconecta wallet."
    }

    if ((connectorId === "walletConnect" || message.toLowerCase().includes("walletconnect")) && isWalletConnectSessionInvalid(message)) {
        return "Sesion WalletConnect invalida. Reabre wallet y reconecta."
    }

    return message || "Wallet connection failed."
}

export async function ensureConnectorProvider(connector?: Connector | null) {
    if (!connector || typeof connector.getProvider !== "function") {
        return {
            ok: false,
            message: "No hay provider activo para este conector. Reconecta wallet.",
        }
    }

    try {
        const provider = await connector.getProvider()
        if (!provider) {
            return {
                ok: false,
                message: "No hay provider activo para este conector. Reconecta wallet.",
            }
        }
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false,
            message: getWalletProviderUserMessage(error, connector.id),
        }
    }
}

