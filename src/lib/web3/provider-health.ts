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

async function tryGetProvider(connector: Connector): Promise<boolean> {
    try {
        const provider = await connector.getProvider()
        return Boolean(provider)
    } catch {
        return false
    }
}

async function clearStaleConnection() {
    try {
        const { disconnect } = await import("@wagmi/core")
        const { wagmiConfig } = await import("@/config/wagmi")
        await disconnect(wagmiConfig)
    } catch {
        // best-effort cleanup
    }
}

export async function ensureConnectorProvider(connector?: Connector | null) {
    if (!connector || typeof connector.getProvider !== "function") {
        await clearStaleConnection()
        return {
            ok: false as const,
            message: "No hay provider activo para este conector. Reconecta wallet.",
        }
    }

    // First attempt
    if (await tryGetProvider(connector)) {
        return { ok: true as const }
    }

    // Brief delay for slow provider injection (e.g. MetaMask extension loading)
    await new Promise((resolve) => setTimeout(resolve, 250))

    // Second attempt after delay
    if (await tryGetProvider(connector)) {
        return { ok: true as const }
    }

    // Attempt wagmi reconnect to recover stale session
    try {
        const { reconnect } = await import("@wagmi/core")
        const { wagmiConfig } = await import("@/config/wagmi")
        await reconnect(wagmiConfig, { connectors: [connector] })
        if (await tryGetProvider(connector)) {
            return { ok: true as const }
        }
    } catch {
        // reconnect failed, will clear stale state below
    }

    // All recovery attempts failed — clear the stale connection so the UI
    // correctly shows "Connect Wallet" instead of a phantom connection.
    await clearStaleConnection()

    // Determine the best user-facing message from the original error
    let userMessage = "No hay provider activo para este conector. Reconecta wallet."
    try {
        await connector.getProvider()
    } catch (error) {
        userMessage = getWalletProviderUserMessage(error, connector.id)
    }

    return {
        ok: false as const,
        message: userMessage,
    }
}
