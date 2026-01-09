"use server"

import turso from "@/lib/turso"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-checks"
import { isWalletAllowed, getTokenGateSettings } from "@/lib/actions/wallet-actions"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { ERC20_ABI, TOKEN_GATE_CONFIG } from "@/config/tokengate"
import { CANONICAL_CATEGORY_NAMES } from "@/lib/brand-categories"

const invariant: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    if (!condition) {
        throw new Error(message)
    }
}

const BrandSchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    warpcastUrl: z.string().url("Invalid Warpcast URL").optional().or(z.literal("")),
    description: z.string().optional(),
    categoryId: z.coerce.number().min(1, "Category is required"),
    imageUrl: z.string().url("Invalid Image URL").optional().or(z.literal("")),
    ownerFid: z.coerce.number().int().positive("Owner FID is required"),
    ownerPrimaryWallet: z
        .string()
        .trim()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
    walletAddress: z.string().optional(),
    channel: z.string().optional(),
    profile: z.string().optional().nullable(),
    queryType: z.coerce.number().min(0).max(1),
    followerCount: z.coerce.number().optional(),
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
        walletAddress?: string[]
        channel?: string[]
        profile?: string[]
        queryType?: string[]
        followerCount?: string[]
    }
    message?: string | null
    success?: boolean
}

export async function createBrand(prevState: State, formData: FormData) {
    // 1. Security Check
    try {
        await requireAdmin()
    } catch {
        return { message: "Unauthorized. Admin access required." }
    }

    // ... (Validation logic remains the same)
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
        ownerFid: formData.get("ownerFid"),
        ownerPrimaryWallet: formData.get("ownerPrimaryWallet"),
        walletAddress: formData.get("walletAddress"),
        channel: formData.get("channel"),
        profile: formData.get("profile"),
        queryType: formData.get("queryType"),
        followerCount: formData.get("followerCount"),
    }

    const validatedFields = BrandSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to Create Brand.",
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
            message: "Missing Fields. Failed to Create Brand.",
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
                channel,
                profile,
                queryType,
                followerCount,
                banned,
                createdAt,
                updatedAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, datetime('now'), datetime('now')
            )`,
            args: [
                validatedFields.data.name,
                validatedFields.data.url || "",
                validatedFields.data.warpcastUrl || "",
                validatedFields.data.description || "",
                validatedFields.data.categoryId,
                validatedFields.data.imageUrl || "",
                validatedFields.data.walletAddress || "",
                validatedFields.data.ownerFid,
                validatedFields.data.ownerPrimaryWallet,
                validatedFields.data.channel || "",
                validatedFields.data.profile || "",
                validatedFields.data.queryType,
                validatedFields.data.followerCount || 0,
                0,
            ],
        })
    } catch (error) {
        console.error("Database Error:", error)
        return {
            message: "Database Error: Failed to Create Brand.",
        }
    }

    revalidatePath("/dashboard/brands")
    return { success: true, message: "Brand created successfully." }
}

export async function updateBrand(id: number, prevState: State, formData: FormData) {
    // 1. Security Check
    try {
        await requireAdmin()
    } catch {
        return { message: "Unauthorized. Admin access required." }
    }

    // ... (Validation logic remains the same)
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
        ownerFid: formData.get("ownerFid"),
        ownerPrimaryWallet: formData.get("ownerPrimaryWallet"),
        walletAddress: formData.get("walletAddress"),
        channel: formData.get("channel"),
        profile: formData.get("profile"),
        queryType: formData.get("queryType"),
        followerCount: formData.get("followerCount"),
    }

    const validatedFields = BrandSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to Update Brand.",
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
                channel = ?,
                profile = ?,
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
                validatedFields.data.ownerFid,
                validatedFields.data.ownerPrimaryWallet,
                validatedFields.data.channel || "",
                validatedFields.data.profile || "",
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
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
        ownerFid: formData.get("ownerFid"),
        ownerPrimaryWallet: formData.get("ownerPrimaryWallet"),
        walletAddress: formData.get("walletAddress"),
        channel: formData.get("channel"),
        profile: formData.get("profile"),
        queryType: formData.get("queryType"),
        followerCount: formData.get("followerCount"),
    }

    const walletAddress = typeof rawData.walletAddress === "string" ? rawData.walletAddress.trim() : ""
    if (!walletAddress) {
        return {
            errors: {
                walletAddress: ["Wallet address is required."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletAddressRegex.test(walletAddress)) {
        return {
            errors: {
                walletAddress: ["Invalid Ethereum address format."],
            },
            message: "Missing Fields. Failed to Apply.",
        }
    }

    const validatedFields = BrandSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to Apply.",
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

    const isAllowlisted = await isWalletAllowed(walletAddress)
    if (!isAllowlisted) {
        return {
            errors: {
                walletAddress: ["Wallet is not allowlisted."],
            },
            message: "Unauthorized. Wallet not allowlisted.",
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
                    channel,
                    profile,
                    queryType,
                    followerCount,
                    banned,
                    createdAt,
                    updatedAt
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, datetime('now'), datetime('now')
                )`,
                args: [
                    validatedFields.data.name,
                    validatedFields.data.url || "",
                    validatedFields.data.warpcastUrl || "",
                    validatedFields.data.description || "",
                    validatedFields.data.categoryId,
                    validatedFields.data.imageUrl || "",
                    walletAddress,
                    validatedFields.data.ownerFid,
                    validatedFields.data.ownerPrimaryWallet,
                    validatedFields.data.channel || "",
                    validatedFields.data.profile || "",
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
            args: [walletAddress as `0x${string}`],
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
                channel,
                profile,
                queryType,
                followerCount,
                banned,
                createdAt,
                updatedAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, datetime('now'), datetime('now')
            )`,
            args: [
                validatedFields.data.name,
                validatedFields.data.url || "",
                validatedFields.data.warpcastUrl || "",
                validatedFields.data.description || "",
                validatedFields.data.categoryId,
                validatedFields.data.imageUrl || "",
                walletAddress,
                validatedFields.data.ownerFid,
                validatedFields.data.ownerPrimaryWallet,
                validatedFields.data.channel || "",
                validatedFields.data.profile || "",
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
    await requireAdmin()

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
