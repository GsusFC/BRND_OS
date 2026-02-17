import type { BrandFormValues } from "@/lib/validations/brand-form"
import { toQueryType } from "@/lib/validations/brand-form"
import {
    normalizeChannelInput,
    normalizeProfileInput,
} from "@/lib/farcaster/normalize-identifiers"
import { normalizeTokenTickerLoose } from "@/lib/tokens/normalize-token-ticker"
import type { SheetBrandResult, SuggestionMap } from "./types"

const asString = (value: unknown): string => (value == null ? "" : String(value))

const onlyChanged = (
    candidate: SuggestionMap,
    getFieldValue: <K extends keyof BrandFormValues>(key: K) => BrandFormValues[K],
): SuggestionMap => {
    const out: SuggestionMap = {}
    for (const key of Object.keys(candidate) as Array<keyof BrandFormValues>) {
        const suggested = candidate[key]
        if (suggested === undefined || suggested === null) continue
        const nextValue = asString(suggested)
        if (!nextValue.trim()) continue
        const current = asString(getFieldValue(key))
        if (current === nextValue) continue
        if (key === "queryType") {
            out.queryType = toQueryType(nextValue)
        } else {
            out[key] = suggested as BrandFormValues[typeof key]
        }
    }
    return out
}

const normalizeProfile = (value: string | null | undefined): string => {
    if (!value) return ""
    try {
        return normalizeProfileInput(value)
    } catch {
        return ""
    }
}

const normalizeChannel = (value: string | null | undefined): string => {
    if (!value) return ""
    try {
        return `/${normalizeChannelInput(value)}`
    } catch {
        return ""
    }
}

export const buildSuggestionsFromSheet = ({
    row,
    getFieldValue,
    categoryMapByName,
    fallbackQueryType,
}: {
    row: SheetBrandResult
    getFieldValue: <K extends keyof BrandFormValues>(key: K) => BrandFormValues[K]
    categoryMapByName: Map<string, string>
    fallbackQueryType: BrandFormValues["queryType"]
}): SuggestionMap => {
    const profile = normalizeProfile(row.profile)
    const channel = normalizeChannel(row.channel)
    const queryTypeSuggestion: BrandFormValues["queryType"] = channel
        ? "0"
        : profile
          ? "1"
          : fallbackQueryType

    const candidate: SuggestionMap = {
        name: row.name || undefined,
        description: row.description || undefined,
        url: row.url || undefined,
        imageUrl: row.iconLogoUrl || undefined,
        categoryId: categoryMapByName.get((row.category ?? "").trim().toLowerCase()) || undefined,
        tokenTicker: normalizeTokenTickerLoose(row.tokenTicker ?? row.ticker) || undefined,
        tokenContractAddress: (row.tokenContractAddress ?? "").trim() || undefined,
        ownerWalletFid: row.guardianFid && row.guardianFid > 0 ? String(row.guardianFid) : undefined,
        queryType: queryTypeSuggestion,
        channel: channel || undefined,
        profile: profile || undefined,
    }

    return onlyChanged(candidate, getFieldValue)
}

export const buildSuggestionsFromFarcaster = ({
    data,
    getFieldValue,
    queryType,
}: {
    data: {
        name?: string | null
        description?: string | null
        imageUrl?: string | null
        followerCount?: string | number | null
        warpcastUrl?: string | null
        url?: string | null
        fid?: string | number | null
        canonicalProfile?: string
        canonicalChannel?: string
    }
    getFieldValue: <K extends keyof BrandFormValues>(key: K) => BrandFormValues[K]
    queryType: BrandFormValues["queryType"]
}): SuggestionMap => {
    const candidate: SuggestionMap = {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        imageUrl: data.imageUrl ?? undefined,
        followerCount:
            data.followerCount === undefined || data.followerCount === null
                ? undefined
                : String(data.followerCount),
        warpcastUrl: data.warpcastUrl ?? undefined,
        url: data.url ?? undefined,
        ownerFid: queryType === "1" && data.fid != null ? String(data.fid) : undefined,
        queryType,
        channel: queryType === "0" ? data.canonicalChannel ?? undefined : undefined,
        profile: queryType === "1" ? data.canonicalProfile ?? undefined : undefined,
    }

    return onlyChanged(candidate, getFieldValue)
}

export const mergeSuggestions = (base: SuggestionMap, incoming: SuggestionMap): SuggestionMap => {
    const out: SuggestionMap = { ...base }
    for (const key of Object.keys(incoming) as Array<keyof BrandFormValues>) {
        const value = incoming[key]
        if (value === undefined || value === null) continue
        const normalized = asString(value).trim()
        if (!normalized) continue
        if (key === "queryType") {
            out.queryType = value === "1" ? "1" : "0"
            continue
        }
        ;(out as Record<string, unknown>)[key] = value
    }
    return out
}
