import { z } from "zod"

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/

export const brandFormSchema = z.object({
    queryType: z.enum(["0", "1"]),
    channel: z.string().optional(),
    profile: z.string().optional(),
    ownerFid: z.string().min(1, "Owner FID is required"),
    warpcastUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
    followerCount: z.string().optional(),

    name: z.string().min(1, "Brand name is required"),
    description: z.string().optional(),
    categoryId: z.string().min(1, "Category is required"),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    imageUrl: z.string().url("Invalid URL").optional().or(z.literal("")),

    ownerPrimaryWallet: z
        .string()
        .regex(ethereumAddressRegex, "Invalid Ethereum address"),
    ownerWalletFid: z.string().optional(),
    walletAddress: z
        .string()
        .regex(ethereumAddressRegex, "Invalid Ethereum address"),

    tokenContractAddress: z
        .string()
        .regex(ethereumAddressRegex, "Invalid contract address")
        .optional()
        .or(z.literal("")),
    tokenTicker: z
        .string()
        .regex(/^[A-Z0-9]{2,10}$/, "Invalid ticker (2-10 uppercase chars)")
        .optional()
        .or(z.literal("")),
}).superRefine((data, ctx) => {
    if (data.queryType === "0" && !data.channel) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Channel is required",
            path: ["channel"],
        })
    }

    if (data.queryType === "1" && !data.profile) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Profile is required",
            path: ["profile"],
        })
    }
})

export type BrandFormValues = z.infer<typeof brandFormSchema>

export const toQueryType = (value: unknown): BrandFormValues["queryType"] =>
    value === "1" ? "1" : "0"
