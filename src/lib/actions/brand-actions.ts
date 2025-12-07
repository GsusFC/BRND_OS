"use server"

import prismaWrite from "@/lib/prisma-write"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

const BrandSchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    warpcastUrl: z.string().url("Invalid Warpcast URL").optional().or(z.literal("")),
    description: z.string().optional(),
    categoryId: z.coerce.number().min(1, "Category is required"),
    imageUrl: z.string().url("Invalid Image URL").optional().or(z.literal("")),
    walletAddress: z.string().optional(),
    channel: z.string().optional(),
    profile: z.string().optional(),
    queryType: z.coerce.number().min(0).max(1),
    followerCount: z.coerce.number().optional(),
})

export type State = {
    errors?: {
        name?: string[]
        url?: string[]
        warpcastUrl?: string[]
        description?: string[]
        categoryId?: string[]
        imageUrl?: string[]
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
    // ... (Validation logic remains the same)
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
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

    try {
        await prismaWrite.brand.create({
            data: {
                ...validatedFields.data,
                url: validatedFields.data.url || "",
                warpcastUrl: validatedFields.data.warpcastUrl || "",
                description: validatedFields.data.description || "",
                imageUrl: validatedFields.data.imageUrl || "",
                channel: validatedFields.data.channel || "",
                profile: validatedFields.data.profile || "",
                followerCount: validatedFields.data.followerCount || 0,
                ranking: "N/A",
                score: 0,
                stateScore: 0,
                scoreWeek: 0,
                stateScoreWeek: 0,
                banned: 0,
            },
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
    // ... (Validation logic remains the same)
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
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

    try {
        // Note: Updating might be tricky if the ID refers to the main DB
        // For now, we assume we are updating local brands or we need a strategy to handle updates across DBs
        // If the ID exists in write DB, update it.
        await prismaWrite.brand.update({
            where: { id },
            data: validatedFields.data,
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

export async function applyBrand(formData: FormData) {
    const rawData = {
        name: formData.get("name"),
        url: formData.get("url"),
        warpcastUrl: formData.get("warpcastUrl"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl"),
        walletAddress: formData.get("walletAddress"),
        channel: formData.get("channel"),
        profile: formData.get("profile"),
        queryType: formData.get("queryType"),
        followerCount: formData.get("followerCount"),
    }

    const validatedData = BrandSchema.parse(rawData)

    await prismaWrite.brand.create({
        data: {
            ...validatedData,
            url: validatedData.url || "",
            warpcastUrl: validatedData.warpcastUrl || "",
            description: validatedData.description || "",
            imageUrl: validatedData.imageUrl || "",
            channel: validatedData.channel || "",
            profile: validatedData.profile || "",
            followerCount: validatedData.followerCount || 0,
            ranking: "N/A",
            score: 0,
            stateScore: 0,
            scoreWeek: 0,
            stateScoreWeek: 0,
            banned: 1, // Created as BANNED (Pending Review) by default
        },
    })

    redirect("/apply/success")
}

export async function toggleBrandStatus(id: number, currentStatus: number) {
    // If currentStatus is 1 (Banned/Pending), new status will be 0 (Active)
    // If currentStatus is 0 (Active), new status will be 1 (Banned)
    const newStatus = currentStatus === 1 ? 0 : 1

    await prismaWrite.brand.update({
        where: { id },
        data: { banned: newStatus },
    })

    revalidatePath("/dashboard/brands")
}
