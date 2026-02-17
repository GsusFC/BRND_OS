import { z } from "zod"
import { TOKEN_TICKER_VALIDATION_MESSAGE } from "@/lib/tokens/normalize-token-ticker"
import {
    TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE,
    isValidTokenContractAddress,
} from "@/lib/tokens/normalize-token-contract"

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/

export const brandFormSchema = z.object({
    queryType: z.enum(["0", "1"]),
    channel: z.string().optional(),
    profile: z.string().optional(),
    ownerFid: z.string().optional(),
    warpcastUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
    followerCount: z.string().optional(),

    name: z.string().min(1, "Brand name is required"),
    description: z.string().optional(),
    categoryId: z.string().min(1, "Category is required"),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    imageUrl: z.string().url("Invalid URL").optional().or(z.literal("")),

    ownerPrimaryWallet: z
        .string()
        .regex(ethereumAddressRegex, "Invalid Ethereum address")
        .optional()
        .or(z.literal("")),
    ownerWalletFid: z.string().optional(),
    walletAddress: z
        .string()
        .regex(ethereumAddressRegex, "Invalid Ethereum address")
        .optional()
        .or(z.literal("")),

    tokenContractAddress: z
        .string()
        .refine(isValidTokenContractAddress, TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE)
        .optional()
        .or(z.literal("")),
    tokenTicker: z
        .string()
        .regex(/^\$?[A-Za-z0-9]{2,10}$/, TOKEN_TICKER_VALIDATION_MESSAGE)
        .optional()
        .or(z.literal("")),
}).superRefine((data, ctx) => {
    if (data.queryType === "0" && !data.channel?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Channel is required and cannot be blank",
            path: ["channel"],
        })
    }

    if (data.queryType === "1" && !data.profile?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Profile is required and cannot be blank",
            path: ["profile"],
        })
    }
})

export type BrandFormValues = z.infer<typeof brandFormSchema>

export const toQueryType = (value: unknown): BrandFormValues["queryType"] =>
    value === "1" ? "1" : "0"
