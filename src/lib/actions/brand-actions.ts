"use server"

import turso from "@/lib/turso"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { requireAnyPermission, requirePermission } from "@/lib/auth-checks"
import { getTokenGateSettings } from "@/lib/actions/wallet-actions"
import { createRateLimiter } from "@/lib/rate-limit"
import { redis } from "@/lib/redis"
import { buildWalletNonceKey, normalizeWalletAddress, verifyWalletSignature } from "@/lib/wallet-signature"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { ERC20_ABI, TOKEN_GATE_CONFIG } from "@/config/tokengate"
import { CANONICAL_CATEGORY_NAMES } from "@/lib/brand-categories"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { getClientIpFromHeaders, getRequestOrigin } from "@/lib/request-utils"
import {
    normalizeTokenTickerInput,
    TOKEN_TICKER_REGEX,
    TOKEN_TICKER_VALIDATION_MESSAGE,
} from "@/lib/tokens/normalize-token-ticker"
import {
    TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE,
    isValidTokenContractAddress,
} from "@/lib/tokens/normalize-token-contract"

const applyRateLimiter = createRateLimiter(redis, {
    keyPrefix: "brnd:ratelimit:apply",
    windowSeconds: 60,
    maxRequests: 5,
})

const invariant: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    if (!condition) {
        throw new Error(message)
    }
}

const FARCASTER_HOST = "farcaster.xyz"
const FARCASTER_HOST_ALIASES = new Set(["warpcast.com", "farcaster.com", "farcaster.xyz"])

const normalizeUrlInput = (value: FormDataEntryValue | null): string => {
    if (typeof value !== "string") return ""
    const trimmed = value.trim()
    if (!trimmed) return ""

    let candidate = trimmed
    if (!candidate.startsWith("http")) {
        candidate = `https://${candidate}`
    }

    try {
        return new URL(candidate).toString()
    } catch {
        return trimmed
    }
}

const normalizeOptionalTextInput = (value: FormDataEntryValue | null): string => {
    if (typeof value !== "string") return ""
    return value.trim()
}

const normalizeHandleInput = (value: string): string => {
    return value.replace(/^[@/]+/, "").trim().toLowerCase()
}

const normalizeTickerInput = (value: FormDataEntryValue | string | null | undefined): string =>
    normalizeTokenTickerInput(typeof value === "string" ? value : "")

const normalizeFarcasterUrlInput = (value: FormDataEntryValue | null): string => {
    if (typeof value !== "string") return ""
    const trimmed = value.trim()
    if (!trimmed) return ""

    let candidate = trimmed
    if (!candidate.startsWith("http")) {
        if (
            candidate.startsWith("warpcast.com/") ||
            candidate.startsWith("www.warpcast.com/") ||
            candidate.startsWith("farcaster.xyz/") ||
            candidate.startsWith("www.farcaster.xyz/") ||
            candidate.startsWith("farcaster.com/") ||
            candidate.startsWith("www.farcaster.com/")
        ) {
            candidate = `https://${candidate.replace(/^www\./, "")}`
        }
    }

    try {
        const parsed = new URL(candidate)
        const hostname = parsed.hostname.replace(/^www\./, "")
        if (FARCASTER_HOST_ALIASES.has(hostname)) {
            parsed.hostname = FARCASTER_HOST
        }
        return parsed.toString()
    } catch {
        return trimmed
    }
}

const BrandSchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    warpcastUrl: z.string().url("Invalid Farcaster URL").optional().or(z.literal("")),
    description: z.string().optional(),
    categoryId: z.coerce.number().min(1, "Category is required"),
    imageUrl: z.string().url("Invalid Image URL").optional().or(z.literal("")),
    ownerFid: z.preprocess(
        (value) => (value === "" || value === null || value === undefined ? undefined : value),
        z.coerce.number().int().positive().optional(),
    ),
    ownerPrimaryWallet: z
        .string()
        .trim()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
    ownerWalletFid: z.preprocess(
        (value) => (value === "" || value === null || value === undefined ? undefined : value),
        z.coerce.number().int().positive().optional(),
    ),
    walletAddress: z.string().optional(),
    channel: z.string().optional(),
    profile: z.string().optional().nullable(),
    queryType: z.coerce.number().min(0).max(1),
    tokenContractAddress: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (value) => value === undefined || value === "" || isValidTokenContractAddress(value),
            TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE,
        ),
    tokenTicker: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (value) => value === undefined || value === "" || TOKEN_TICKER_REGEX.test(value),
            TOKEN_TICKER_VALIDATION_MESSAGE,
        ),
    tickerTokenId: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (value) =>
                value === undefined ||
                value === "" ||
                /^eip155:\d+\/erc20:0x[a-fA-F0-9]{40}$/.test(value),
            "Invalid tickerTokenId format (expected eip155:<chainId>/erc20:0x...)",
        ),
    followerCount: z.preprocess(
        (value) => (value === "" || value === null || value === undefined ? undefined : value),
        z.coerce.number().int().nonnegative().optional(),
    ),
}).transform(data => ({
    ...data,
    profile: data.profile ?? "",
}))

export type State = {
    errors?: {
        name?: string[]
        url?: string[]
        warpcastUrl?: string[]
        description?: string[]
        categoryId?: string[]
        imageUrl?: string[]
        ownerFid?: string[]
        ownerPrimaryWallet?: string[]
        ownerWalletFid?: string[]
        walletAddress?: string[]
        channel?: string[]
        profile?: string[]
        queryType?: string[]
        tokenContractAddress?: string[]
        tokenTicker?: string[]
        tickerTokenId?: string[]
        followerCount?: string[]
    }
    message?: string | null
    success?: boolean
}

const buildValidationMessage = (errors: Record<string, string[] | undefined>): string => {
    const firstKey = Object.keys(errors).find((key) => errors[key]?.length)
    if (!firstKey) return "Missing Fields. Failed to Apply."
    const firstMessage = errors[firstKey]?.[0]
    return firstMessage ? `Validation failed: ${firstMessage}` : "Missing Fields. Failed to Apply."
}

export async function updateBrand(id: number, prevState: State, formData: FormData) {
    // 1. Security Check
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { message: "Unauthorized. Permission required." }
    }

    // ... (Validation logic remains the same)
    const rawData = {
        name: formData.get("name"),
        url: normalizeUrlInput(formData.get("url")),
        warpcastUrl: normalizeFarcasterUrlInput(formData.get("warpcastUrl")),
        description: normalizeOptionalTextInput(formData.get("description")),
        categoryId: formData.get("categoryId"),
        imageUrl: normalizeUrlInput(formData.get("imageUrl")),
        ownerFid: formData.get("ownerFid"),
        ownerPrimaryWallet: formData.get("ownerPrimaryWallet"),
        ownerWalletFid: formData.get("ownerWalletFid"),
        walletAddress: normalizeOptionalTextInput(formData.get("walletAddress")),
        channel: normalizeOptionalTextInput(formData.get("channel")),
        profile: normalizeOptionalTextInput(formData.get("profile")),
        queryType: formData.get("queryType"),
        tokenContractAddress: normalizeOptionalTextInput(formData.get("tokenContractAddress")),
        tokenTicker: normalizeTickerInput(formData.get("tokenTicker")),
        tickerTokenId: normalizeOptionalTextInput(formData.get("tickerTokenId")),
        followerCount: formData.get("followerCount"),
    }

    const validatedFields = BrandSchema.safeParse(rawData)

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors
        return {
            errors: fieldErrors,
            message: buildValidationMessage(fieldErrors),
        }
    }

    const categoryResult = await turso.execute({
        sql: 'SELECT name FROM categories WHERE id = ? LIMIT 1',
        args: [validatedFields.data.categoryId],
    })
    const categoryNameRaw = categoryResult.rows[0]?.name
    const categoryName = typeof categoryNameRaw === 'string' ? categoryNameRaw : categoryNameRaw ? String(categoryNameRaw) : ''

    if (!categoryName || !CANONICAL_CATEGORY_NAMES.includes(categoryName as (typeof CANONICAL_CATEGORY_NAMES)[number])) {
        return {
            errors: {
                categoryId: ["Invalid category."],
            },
            message: "Missing Fields. Failed to Update Brand.",
        }
    }

    try {
        invariant(Number.isFinite(id) && id > 0, 'Invalid brand id')

        const existingWithName = await turso.execute({
            sql: 'SELECT id FROM brands WHERE name = ? AND id != ? LIMIT 1',
            args: [validatedFields.data.name, id],
        })
        if (existingWithName.rows.length > 0) {
            return {
                errors: {
                    name: ["Brand already exists."],
                },
                message: "Database Error: Brand already exists.",
            }
        }

        await turso.execute({
            sql: `UPDATE brands SET
                name = ?,
                url = ?,
                warpcastUrl = ?,
                description = ?,
                categoryId = ?,
                imageUrl = ?,
                walletAddress = ?,
                ownerFid = ?,
                ownerPrimaryWallet = ?,
                ownerWalletFid = ?,
                channel = ?,
                profile = ?,
                tokenContractAddress = ?,
                tokenTicker = ?,
                queryType = ?,
                followerCount = ?,
                updatedAt = datetime('now')
            WHERE id = ?`,
            args: [
                validatedFields.data.name,
                validatedFields.data.url || "",
                validatedFields.data.warpcastUrl || "",
                validatedFields.data.description || "",
                validatedFields.data.categoryId,
                validatedFields.data.imageUrl || "",
                validatedFields.data.walletAddress || "",
                validatedFields.data.ownerFid ?? null,
                validatedFields.data.ownerPrimaryWallet,
                validatedFields.data.ownerWalletFid ?? null,
                validatedFields.data.channel || "",
                validatedFields.data.profile || "",
                validatedFields.data.tokenContractAddress || "",
                validatedFields.data.tokenTicker || "",
                validatedFields.data.queryType,
                validatedFields.data.followerCount || 0,
                id,
            ],
        })
    } catch (error) {
        console.error("Database Error:", error)
        return {
            message: "Database Error: Failed to Update Brand.",
        }
    }

    revalidatePath("/dashboard/brands")
    return { success: true, message: "Brand updated successfully." }
}

export async function applyBrand(prevState: State, formData: FormData) {
    const requestHeaders = await headers()
    const clientIp = getClientIpFromHeaders(requestHeaders)
    if (!clientIp) {
        return { message: "Missing client IP." }
    }

    const allowed = await applyRateLimiter(clientIp)
    if (!allowed) {
        return { message: "Rate limit exceeded. Try again later." }
    }

    const walletSignatureRaw = formData.get("walletSignature")
    const walletNonceRaw = formData.get("walletNonce")

    if (typeof walletSignatureRaw !== "string" || !walletSignatureRaw.trim()) {
        return { message: "Missing wallet signature." }
    }

    if (typeof walletNonceRaw !== "string" || !walletNonceRaw.trim()) {
        return { message: "Missing wallet nonce." }
    }

    const signature = walletSignatureRaw.trim()
    const nonce = walletNonceRaw.trim()

    if (!signature.startsWith("0x")) {
        return { message: "Invalid wallet signature." }
    }

    const requestOrigin = getRequestOrigin(requestHeaders)
    if (!requestOrigin) {
        return { message: "Missing request origin." }
    }

    const rawData = {
        name: formData.get("name"),
        url: normalizeUrlInput(formData.get("url")),
        warpcastUrl: normalizeFarcasterUrlInput(formData.get("warpcastUrl")),
        description: normalizeOptionalTextInput(formData.get("description")),
        categoryId: formData.get("categoryId"),
        imageUrl: normalizeUrlInput(formData.get("imageUrl")),
        ownerFid: formData.get("ownerFid"),
        ownerPrimaryWallet: formData.get("ownerPrimaryWallet"),
        ownerWalletFid: formData.get("ownerWalletFid"),
        walletAddress: normalizeOptionalTextInput(formData.get("walletAddress")),
        channel: normalizeOptionalTextInput(formData.get("channel")),
        profile: normalizeOptionalTextInput(formData.get("profile")),
        queryType: formData.get("queryType"),
        tokenContractAddress: normalizeOptionalTextInput(formData.get("tokenContractAddress")),
        tokenTicker: normalizeTickerInput(formData.get("tokenTicker")),
        tickerTokenId: normalizeOptionalTextInput(formData.get("tickerTokenId")),
        followerCount: formData.get("followerCount"),
    }

    const walletAddressInput = typeof rawData.walletAddress === "string" ? rawData.walletAddress.trim() : ""
    if (!walletAddressInput) {
        return {
            errors: {
                walletAddress: ["Wallet address is required."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    let normalizedWalletAddress: string
    try {
        normalizedWalletAddress = normalizeWalletAddress(walletAddressInput)
    } catch {
        return {
            errors: {
                walletAddress: ["Invalid Ethereum address format."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletAddressRegex.test(normalizedWalletAddress)) {
        return {
            errors: {
                walletAddress: ["Invalid Ethereum address format."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    rawData.walletAddress = normalizedWalletAddress

    const nonceKey = buildWalletNonceKey(normalizedWalletAddress, nonce)
    const nonceRecord = await redis.get<{ origin: string; expiresAt: number }>(nonceKey)
    if (!nonceRecord) {
        return { message: "Nonce inválido o expirado." }
    }

    if (nonceRecord.origin !== requestOrigin) {
        return { message: "Invalid signature origin." }
    }

    if (!Number.isFinite(nonceRecord.expiresAt) || Date.now() > nonceRecord.expiresAt) {
        return { message: "Nonce expirado." }
    }

    const isSignatureValid = await verifyWalletSignature({
        address: normalizedWalletAddress,
        nonce,
        expiresAt: nonceRecord.expiresAt,
        origin: nonceRecord.origin,
        signature,
    })

    if (!isSignatureValid) {
        return { message: "Invalid wallet signature." }
    }

    await redis.del(nonceKey)

    const validatedFields = BrandSchema.safeParse(rawData)

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors
        return {
            errors: fieldErrors,
            message: buildValidationMessage(fieldErrors),
        }
    }

    const categoryResult = await turso.execute({
        sql: 'SELECT name FROM categories WHERE id = ? LIMIT 1',
        args: [validatedFields.data.categoryId],
    })
    const categoryNameRaw = categoryResult.rows[0]?.name
    const categoryName = typeof categoryNameRaw === 'string' ? categoryNameRaw : categoryNameRaw ? String(categoryNameRaw) : ''

    if (!categoryName || !CANONICAL_CATEGORY_NAMES.includes(categoryName as (typeof CANONICAL_CATEGORY_NAMES)[number])) {
        return {
            errors: {
                categoryId: ["Invalid category."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    const disableOnchain = process.env.DISABLE_ONCHAIN_GATING === "true"
    if (disableOnchain) {
        try {
            const existing = await turso.execute({
                sql: 'SELECT id FROM brands WHERE name = ? LIMIT 1',
                args: [validatedFields.data.name],
            })
            if (existing.rows.length > 0) {
                return {
                    errors: {
                        name: ["Brand already exists."],
                    },
                    message: "Database Error: Brand already exists.",
                }
            }

            await turso.execute({
                sql: `INSERT INTO brands (
                    name,
                    url,
                    warpcastUrl,
                    description,
                    categoryId,
                    imageUrl,
                    walletAddress,
                    ownerFid,
                    ownerPrimaryWallet,
                    ownerWalletFid,
                    channel,
                    profile,
                    tokenContractAddress,
                    tokenTicker,
                    queryType,
                    followerCount,
                    banned,
                    createdAt,
                    updatedAt
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now'), datetime('now')
                )`,
                args: [
                    validatedFields.data.name,
                    validatedFields.data.url || "",
                    validatedFields.data.warpcastUrl || "",
                    validatedFields.data.description || "",
                    validatedFields.data.categoryId,
                    validatedFields.data.imageUrl || "",
                    normalizedWalletAddress,
                    validatedFields.data.ownerFid ?? null,
                    validatedFields.data.ownerPrimaryWallet,
                    validatedFields.data.ownerWalletFid ?? null,
                    validatedFields.data.channel || "",
                    validatedFields.data.profile || "",
                    validatedFields.data.tokenContractAddress || "",
                    validatedFields.data.tokenTicker || "",
                    validatedFields.data.queryType,
                    validatedFields.data.followerCount || 0,
                    1,
                ],
            })
        } catch {
            return {
                message: "Database Error: Failed to Submit Application.",
            }
        }

        return {
            success: true,
            message: "Solicitud enviada",
        }
    }

    const rpcUrl = process.env.BASE_RPC_URL
    if (!rpcUrl) {
        return {
            message: "Server misconfiguration: BASE_RPC_URL is not set.",
        }
    }

    let minTokenBalanceUnits: bigint
    try {
        const settings = await getTokenGateSettings()
        const parsed = BigInt(settings.minTokenBalance)
        if (parsed < BigInt(0)) {
            return { message: "Server misconfiguration: minTokenBalance is invalid." }
        }
        minTokenBalanceUnits = parsed
    } catch {
        return {
            message: "Server Error: Failed to load token gate settings.",
        }
    }

    const minBalanceWithDecimals =
        minTokenBalanceUnits * (BigInt(10) ** BigInt(TOKEN_GATE_CONFIG.decimals))

    try {
        const client = createPublicClient({
            chain: base,
            transport: http(rpcUrl),
        })

        const balance = await client.readContract({
            address: TOKEN_GATE_CONFIG.tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [normalizedWalletAddress as `0x${string}`],
        })

        if (balance < minBalanceWithDecimals) {
            return {
                errors: {
                    walletAddress: ["Insufficient token balance."],
                },
                message: "Unauthorized. Insufficient token balance.",
            }
        }
    } catch {
        return {
            message: "Server Error: Failed to verify token balance.",
        }
    }

    try {
        const existing = await turso.execute({
            sql: 'SELECT id FROM brands WHERE name = ? LIMIT 1',
            args: [validatedFields.data.name],
        })
        if (existing.rows.length > 0) {
            return {
                errors: {
                    name: ["Brand already exists."],
                },
                message: "Database Error: Brand already exists.",
            }
        }

            await turso.execute({
                sql: `INSERT INTO brands (
                    name,
                    url,
                    warpcastUrl,
                    description,
                    categoryId,
                    imageUrl,
                    walletAddress,
                    ownerFid,
                    ownerPrimaryWallet,
                    ownerWalletFid,
                    channel,
                    profile,
                    tokenContractAddress,
                    tokenTicker,
                    queryType,
                    followerCount,
                    banned,
                    createdAt,
                    updatedAt
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now'), datetime('now')
                )`,
                args: [
                    validatedFields.data.name,
                    validatedFields.data.url || "",
                    validatedFields.data.warpcastUrl || "",
                    validatedFields.data.description || "",
                    validatedFields.data.categoryId,
                    validatedFields.data.imageUrl || "",
                    normalizedWalletAddress,
                    validatedFields.data.ownerFid ?? null,
                    validatedFields.data.ownerPrimaryWallet,
                    validatedFields.data.ownerWalletFid ?? null,
                    validatedFields.data.channel || "",
                    validatedFields.data.profile || "",
                    validatedFields.data.tokenContractAddress || "",
                    validatedFields.data.tokenTicker || "",
                    validatedFields.data.queryType,
                    validatedFields.data.followerCount || 0,
                    1,
                ],
            })
    } catch {
        return {
            message: "Database Error: Failed to Submit Application.",
        }
    }

    return {
        success: true,
        message: "Solicitud enviada",
    }
}

export async function toggleBrandStatus(id: number, currentStatus: number) {
    // 1. Security Check
    await requirePermission(PERMISSIONS.BRANDS)

    // If currentStatus is 1 (Banned/Pending), new status will be 0 (Active)
    // If currentStatus is 0 (Active), new status will be 1 (Banned)
    const newStatus = currentStatus === 1 ? 0 : 1

    invariant(Number.isFinite(id) && id > 0, 'Invalid brand id')

    await turso.execute({
        sql: "UPDATE brands SET banned = ?, updatedAt = datetime('now') WHERE id = ?",
        args: [newStatus, id],
    })

    revalidatePath("/dashboard/brands")
}

export async function deleteBrand(id: number) {
    // 1. Security Check
    await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])

    invariant(Number.isFinite(id) && id > 0, "Invalid brand id")

    try {
        await turso.execute({
            sql: "DELETE FROM brands WHERE id = ?",
            args: [id],
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: "Database Error: Failed to delete brand." }
    }

    revalidatePath("/dashboard/brands")
    revalidatePath("/dashboard/applications")
    return { success: true, message: "Brand deleted successfully." }
}

export type PrepareMetadataPayload = {
    name: string
    handle: string
    fid: number
    walletAddress: string
    url: string
    warpcastUrl: string
    description: string
    categoryId: number | null
    followerCount: number | null
    imageUrl: string
    profile: string
    channel: string
    queryType: number
    channelOrProfile: string
    isEditing: boolean
    brandId?: number
    tokenContractAddress?: string | null
    tokenTicker?: string | null
    contractAddress?: string | null
    ticker?: string | null
    tickerTokenId?: string | null
}

export type PrepareMetadataResponse = {
    success: boolean
    valid: boolean
    metadataHash?: string
    handle?: string
    fid?: number
    walletAddress?: string
    message?: string
    conflicts?: string[]
}

export type CreateBrandDirectPayload = PrepareMetadataPayload & {
    ownerPrimaryWallet: string
    ownerWalletFid?: number | null
    name: string
    url: string
    warpcastUrl: string
    description: string
    categoryId: number | null
    imageUrl: string
    followerCount: number | null
}

export async function prepareBrandMetadata(
    payload: PrepareMetadataPayload,
): Promise<PrepareMetadataResponse> {
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { success: false, valid: false, message: "Unauthorized. Permission required." }
    }

    const apiKey = process.env.INDEXER_API_KEY
    if (!apiKey) {
        return { success: false, valid: false, message: "Server misconfiguration: INDEXER_API_KEY is not set." }
    }

    const baseUrl = process.env.BACKEND_API_BASE_URL || "https://brnd-v2-backend-production.up.railway.app"
    const sourceHeader = process.env.INDEXER_SOURCE || "ponder-stories-in-motion-v8"
    const endpoint = `${baseUrl.replace(/\/$/, "")}/blockchain-service/brands/prepare-metadata`

    let response: Response
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "X-Indexer-Source": sourceHeader,
            },
            body: JSON.stringify(payload),
        })
    } catch (error) {
        console.error("Error calling prepare-metadata:", error)
        return { success: false, valid: false, message: "Network Error: Failed to reach backend." }
    }

    if (!response.ok) {
        return {
            success: false,
            valid: false,
            message: `Backend Error: ${response.status} ${response.statusText}`,
        }
    }

    const data = (await response.json()) as PrepareMetadataResponse
    return data
}

export async function createBrandDirect(payload: CreateBrandDirectPayload) {
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { success: false, message: "Unauthorized. Permission required." }
    }

    const rawData = {
        name: payload.name,
        url: normalizeUrlInput(payload.url),
        warpcastUrl: normalizeFarcasterUrlInput(payload.warpcastUrl),
        description: normalizeOptionalTextInput(payload.description),
        categoryId: payload.categoryId ?? undefined,
        imageUrl: normalizeUrlInput(payload.imageUrl),
        ownerFid: payload.fid > 0 ? payload.fid : (payload.ownerWalletFid ?? undefined),
        ownerPrimaryWallet: payload.ownerPrimaryWallet,
        ownerWalletFid: payload.ownerWalletFid ?? undefined,
        walletAddress: normalizeOptionalTextInput(payload.walletAddress),
        channel: normalizeOptionalTextInput(payload.channel),
        profile: normalizeOptionalTextInput(payload.profile),
        queryType: payload.queryType,
        tokenContractAddress: normalizeOptionalTextInput(payload.tokenContractAddress || ""),
        tokenTicker: normalizeTickerInput(payload.tokenTicker || ""),
        tickerTokenId: normalizeOptionalTextInput(payload.tickerTokenId || ""),
        followerCount: payload.followerCount ?? undefined,
    }

    const validatedFields = BrandSchema.safeParse(rawData)
    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors
        return {
            success: false,
            message: buildValidationMessage(fieldErrors),
            errors: fieldErrors,
        }
    }

    const walletAddressInput = typeof validatedFields.data.walletAddress === "string"
        ? validatedFields.data.walletAddress.trim()
        : ""
    if (!walletAddressInput) {
        return { success: false, message: "Wallet address is required." }
    }

    let normalizedWalletAddress: string
    try {
        normalizedWalletAddress = normalizeWalletAddress(walletAddressInput)
    } catch {
        return { success: false, message: "Invalid wallet address format." }
    }

    const categoryResult = await turso.execute({
        sql: 'SELECT name FROM categories WHERE id = ? LIMIT 1',
        args: [validatedFields.data.categoryId],
    })
    const categoryNameRaw = categoryResult.rows[0]?.name
    const categoryName = typeof categoryNameRaw === 'string' ? categoryNameRaw : categoryNameRaw ? String(categoryNameRaw) : ''
    if (!categoryName || !CANONICAL_CATEGORY_NAMES.includes(categoryName as (typeof CANONICAL_CATEGORY_NAMES)[number])) {
        return { success: false, message: "Invalid category." }
    }

    try {
        const existing = await turso.execute({
            sql: 'SELECT id FROM brands WHERE name = ? LIMIT 1',
            args: [validatedFields.data.name],
        })
        if (existing.rows.length > 0) {
            return { success: false, message: "Brand already exists." }
        }

        const handleCandidate = normalizeHandleInput(payload.channelOrProfile || "")
        if (handleCandidate) {
            const existingHandle = await turso.execute({
                sql: "SELECT id FROM brands WHERE lower(channel) = ? OR lower(profile) = ? LIMIT 1",
                args: [handleCandidate, handleCandidate],
            })
            if (existingHandle.rows.length > 0) {
                return { success: false, message: "Handle already exists." }
            }
        }

        await turso.execute({
            sql: `INSERT INTO brands (
                name,
                url,
                warpcastUrl,
                description,
                categoryId,
                imageUrl,
                walletAddress,
                ownerFid,
                ownerPrimaryWallet,
                ownerWalletFid,
                channel,
                profile,
                tokenContractAddress,
                tokenTicker,
                queryType,
                followerCount,
                banned,
                createdAt,
                updatedAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
            )`,
            args: [
                validatedFields.data.name,
                validatedFields.data.url || "",
                validatedFields.data.warpcastUrl || "",
                validatedFields.data.description || "",
                validatedFields.data.categoryId,
                validatedFields.data.imageUrl || "",
                normalizedWalletAddress,
                validatedFields.data.ownerFid ?? null,
                validatedFields.data.ownerPrimaryWallet,
                validatedFields.data.ownerWalletFid ?? null,
                validatedFields.data.channel || "",
                validatedFields.data.profile || "",
                validatedFields.data.tokenContractAddress || "",
                validatedFields.data.tokenTicker || "",
                validatedFields.data.queryType,
                validatedFields.data.followerCount || 0,
                0,
            ],
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: "Database Error: Failed to Create Brand." }
    }

    revalidatePath("/dashboard/brands")
    revalidatePath("/dashboard/applications")
    return { success: true, message: "Brand created successfully." }
}

export type OnchainUpdateDbBrandData = {
    id: number
    name: string
    url: string
    warpcastUrl: string
    description: string
    categoryId: number | null
    followerCount: number
    imageUrl: string
    profile: string
    channel: string
    queryType: number
    ownerFid: number | null
    ownerWalletFid: number | null
    walletAddress: string
    tokenContractAddress: string
    tokenTicker: string
}

export async function getOnchainUpdateBrandFromDb(brandId: number) {
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { success: false, message: "Unauthorized. Permission required." }
    }

    invariant(Number.isFinite(brandId) && brandId > 0, "Invalid brand id")

    try {
        const selectBrandSql = `SELECT
            id,
            name,
            url,
            warpcastUrl,
            description,
            categoryId,
            followerCount,
            imageUrl,
            profile,
            channel,
            queryType,
            ownerFid,
            ownerWalletFid,
            walletAddress,
            tokenContractAddress,
            tokenTicker
        FROM brands
        WHERE %WHERE%
        LIMIT 1`

        let result
        try {
            result = await turso.execute({
                sql: selectBrandSql.replace("%WHERE%", "onChainId = ? OR id = ?"),
                args: [brandId, brandId],
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : ""
            const missingOnChainIdColumn = /no such column: onChainId|unknown column 'onChainId'/i.test(message)
            if (!missingOnChainIdColumn) throw error
            result = await turso.execute({
                sql: selectBrandSql.replace("%WHERE%", "id = ?"),
                args: [brandId],
            })
        }

        const row = result.rows[0]
        if (!row) {
            return { success: false, message: "Brand not found in DB." }
        }

        const data: OnchainUpdateDbBrandData = {
            id: Number(row.id),
            name: row.name === null || row.name === undefined ? "" : String(row.name),
            url: row.url === null || row.url === undefined ? "" : String(row.url),
            warpcastUrl: row.warpcastUrl === null || row.warpcastUrl === undefined ? "" : String(row.warpcastUrl),
            description: row.description === null || row.description === undefined ? "" : String(row.description),
            categoryId: row.categoryId === null || row.categoryId === undefined ? null : Number(row.categoryId),
            followerCount: row.followerCount === null || row.followerCount === undefined ? 0 : Number(row.followerCount),
            imageUrl: row.imageUrl === null || row.imageUrl === undefined ? "" : String(row.imageUrl),
            profile: row.profile === null || row.profile === undefined ? "" : String(row.profile),
            channel: row.channel === null || row.channel === undefined ? "" : String(row.channel),
            queryType: row.queryType === null || row.queryType === undefined ? 0 : Number(row.queryType),
            ownerFid: row.ownerFid === null || row.ownerFid === undefined ? null : Number(row.ownerFid),
            ownerWalletFid: row.ownerWalletFid === null || row.ownerWalletFid === undefined ? null : Number(row.ownerWalletFid),
            walletAddress: row.walletAddress === null || row.walletAddress === undefined ? "" : String(row.walletAddress),
            tokenContractAddress:
                row.tokenContractAddress === null || row.tokenContractAddress === undefined ? "" : String(row.tokenContractAddress),
            tokenTicker: row.tokenTicker === null || row.tokenTicker === undefined ? "" : String(row.tokenTicker),
        }

        return { success: true, data }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: "Database Error: Failed to load brand from DB." }
    }
}

export type SyncUpdatedOnchainBrandInDbPayload = {
    brandId: number
    name: string
    url: string
    warpcastUrl: string
    description: string
    categoryId: number | null
    followerCount: number | null
    imageUrl: string
    profile: string
    channel: string
    queryType: number
    ownerFid: number | null
    ownerWalletFid: number | null
    walletAddress: string
    tokenContractAddress?: string | null
    tokenTicker?: string | null
}

export type SyncUpdatedOnchainBrandInDbCode = "DB_CONN" | "VALIDATION" | "NOT_FOUND" | "UNKNOWN"
export type SyncUpdatedOnchainBrandInDbResponse = {
    success: boolean
    message: string
    code?: SyncUpdatedOnchainBrandInDbCode
    errors?: Record<string, string[] | undefined>
}

const SyncUpdatedOnchainBrandInDbSchema = z.object({
    brandId: z.number().int().positive(),
    name: z.string().trim().min(1, "Name is required"),
    url: z.string().optional(),
    warpcastUrl: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.number().int().positive().nullable(),
    followerCount: z.number().int().nonnegative().nullable(),
    imageUrl: z.string().optional(),
    profile: z.string().optional(),
    channel: z.string().optional(),
    queryType: z.number().int().min(0).max(1),
    ownerFid: z.number().int().positive().nullable(),
    ownerWalletFid: z.number().int().positive().nullable(),
    walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    tokenContractAddress: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (value) => value === undefined || value === "" || isValidTokenContractAddress(value),
            TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE,
        ),
    tokenTicker: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (value) => value === undefined || value === "" || TOKEN_TICKER_REGEX.test(value),
            TOKEN_TICKER_VALIDATION_MESSAGE,
        ),
})

export async function syncUpdatedOnchainBrandInDb(
    payload: SyncUpdatedOnchainBrandInDbPayload
): Promise<SyncUpdatedOnchainBrandInDbResponse> {
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { success: false, message: "Unauthorized. Permission required.", code: "UNKNOWN" }
    }

    const normalizedPayload = {
        brandId: payload.brandId,
        name: payload.name.trim(),
        url: normalizeUrlInput(payload.url),
        warpcastUrl: normalizeFarcasterUrlInput(payload.warpcastUrl),
        description: (payload.description ?? "").trim(),
        categoryId: payload.categoryId ?? null,
        followerCount: payload.followerCount ?? 0,
        imageUrl: normalizeUrlInput(payload.imageUrl),
        profile: (payload.profile ?? "").trim(),
        channel: (payload.channel ?? "").trim(),
        queryType: payload.queryType,
        ownerFid: payload.ownerFid ?? null,
        ownerWalletFid: payload.ownerWalletFid ?? null,
        walletAddress: payload.walletAddress.trim(),
        tokenContractAddress: (payload.tokenContractAddress ?? "").trim(),
        tokenTicker: normalizeTickerInput(payload.tokenTicker ?? ""),
    }

    const validated = SyncUpdatedOnchainBrandInDbSchema.safeParse(normalizedPayload)
    if (!validated.success) {
        const fieldErrors = validated.error.flatten().fieldErrors
        return {
            success: false,
            message: buildValidationMessage(fieldErrors),
            code: "VALIDATION",
            errors: fieldErrors,
        }
    }

    try {
        const baseArgs = [
            validated.data.name,
            validated.data.url || "",
            validated.data.warpcastUrl || "",
            validated.data.description || "",
            validated.data.categoryId,
            validated.data.followerCount || 0,
            validated.data.imageUrl || "",
            validated.data.profile || "",
            validated.data.channel || "",
            validated.data.queryType,
            validated.data.ownerFid,
            validated.data.ownerWalletFid,
            validated.data.walletAddress,
            validated.data.tokenContractAddress || "",
            validated.data.tokenTicker || "",
        ]

        let result
        try {
            result = await turso.execute({
                sql: `UPDATE brands SET
                    name = ?,
                    url = ?,
                    warpcastUrl = ?,
                    description = ?,
                    categoryId = ?,
                    followerCount = ?,
                    imageUrl = ?,
                    profile = ?,
                    channel = ?,
                    queryType = ?,
                    ownerFid = ?,
                    ownerWalletFid = ?,
                    walletAddress = ?,
                    tokenContractAddress = ?,
                    tokenTicker = ?,
                    onChainId = ?,
                    updatedAt = datetime('now')
                WHERE onChainId = ?`,
                args: [...baseArgs, validated.data.brandId, validated.data.brandId],
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : ""
            const missingOnChainIdColumn = /no such column: onChainId|unknown column 'onChainId'/i.test(message)
            if (!missingOnChainIdColumn) throw error
            result = { rowsAffected: 0 }
        }

        if (typeof result.rowsAffected === "number" && result.rowsAffected === 0) {
            const legacyResult = await turso.execute({
                sql: `UPDATE brands SET
                    name = ?,
                    url = ?,
                    warpcastUrl = ?,
                    description = ?,
                    categoryId = ?,
                    followerCount = ?,
                    imageUrl = ?,
                    profile = ?,
                    channel = ?,
                    queryType = ?,
                    ownerFid = ?,
                    ownerWalletFid = ?,
                    walletAddress = ?,
                    tokenContractAddress = ?,
                    tokenTicker = ?,
                    updatedAt = datetime('now')
                WHERE id = ?`,
                args: [...baseArgs, validated.data.brandId],
            })
            if (typeof legacyResult.rowsAffected === "number" && legacyResult.rowsAffected === 0) {
                return { success: false, message: "Brand not found in DB by onChainId or id.", code: "NOT_FOUND" }
            }
        }
    } catch (error) {
        console.error("Database Error:", error)
        const message = error instanceof Error ? error.message : "Unknown DB error."
        const likelyConnectionIssue = /connect|connection|timeout|network|fetch failed|socket|unreachable/i.test(message)
        return {
            success: false,
            message: "Database Error: Failed to sync updated brand.",
            code: likelyConnectionIssue ? "DB_CONN" : "UNKNOWN",
        }
    }

    revalidatePath("/dashboard/brands")
    revalidatePath("/dashboard/applications")
    return { success: true, message: "Brand synced in DB." }
}

export async function checkBrandHandleExists(handle: string) {
    try {
        await requireAnyPermission([PERMISSIONS.BRANDS, PERMISSIONS.APPLICATIONS])
    } catch {
        return { success: false, exists: false, message: "Unauthorized. Permission required." }
    }

    const normalized = normalizeHandleInput(handle || "")
    if (!normalized) {
        return { success: true, exists: false }
    }

    const existing = await turso.execute({
        sql: "SELECT id FROM brands WHERE lower(channel) = ? OR lower(profile) = ? LIMIT 1",
        args: [normalized, normalized],
    })

    return { success: true, exists: existing.rows.length > 0 }
}

export async function approveBrandInDb(id: number) {
    try {
        await requirePermission(PERMISSIONS.APPLICATIONS)
    } catch {
        return { message: "Unauthorized. Permission required." }
    }

    invariant(Number.isFinite(id) && id > 0, "Invalid brand id")

    await turso.execute({
        sql: "UPDATE brands SET banned = 0, updatedAt = datetime('now') WHERE id = ?",
        args: [id],
    })

    revalidatePath("/dashboard/brands")
    revalidatePath("/dashboard/applications")

    return { success: true, message: "Brand approved successfully." }
}
