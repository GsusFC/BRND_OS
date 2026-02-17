import { useCallback, useState } from "react"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import type { BrandFormValues } from "@/lib/validations/brand-form"

import { buildSuggestionsFromFarcaster, buildSuggestionsFromSheet, mergeSuggestions } from "./mappers"
import type {
    FarcasterFetchResult,
    FetchNotice,
    FetchSource,
    SheetBrandResult,
    SuggestionMap,
} from "./types"

const RELIABLE_SCORE_THRESHOLD = 300

export function useOnchainFetch({
    queryType,
    channelOrProfile,
    categoryMapByName,
    getFieldValue,
    setFieldValue,
    resetMessages,
    onCanonicalHandle,
}: {
    queryType: BrandFormValues["queryType"]
    channelOrProfile: string
    categoryMapByName: Map<string, string>
    getFieldValue: <K extends keyof BrandFormValues>(key: K) => BrandFormValues[K]
    setFieldValue: <K extends keyof BrandFormValues>(
        key: K,
        value: BrandFormValues[K],
        options?: { dirty?: boolean },
    ) => void
    resetMessages: () => void
    onCanonicalHandle?: (handle: string) => void
}) {
    const [fetchSource, setFetchSource] = useState<FetchSource>("farcaster")
    const [sheetQuery, setSheetQuery] = useState("")
    const [isFetching, setIsFetching] = useState(false)
    const [isSheetSearching, setIsSheetSearching] = useState(false)
    const [suggestions, setSuggestions] = useState<SuggestionMap | null>(null)
    const [notice, setNotice] = useState<FetchNotice | null>(null)

    const applySuggestion = useCallback(
        (key: keyof BrandFormValues) => {
            setSuggestions((prev) => {
                if (!prev || prev[key] === undefined) return prev
                setFieldValue(key, prev[key] as BrandFormValues[typeof key], { dirty: true })
                const next = { ...prev }
                delete next[key]
                return Object.keys(next).length > 0 ? next : null
            })
        },
        [setFieldValue],
    )

    const ignoreSuggestion = useCallback((key: keyof BrandFormValues) => {
        setSuggestions((prev) => {
            if (!prev) return prev
            const next = { ...prev }
            delete next[key]
            return Object.keys(next).length > 0 ? next : null
        })
    }, [])

    const acceptAllSuggestions = useCallback(() => {
        setSuggestions((prev) => {
            if (!prev) return prev
            for (const key of Object.keys(prev) as Array<keyof BrandFormValues>) {
                setFieldValue(key, prev[key] as BrandFormValues[typeof key], { dirty: true })
            }
            setNotice(null)
            return null
        })
    }, [setFieldValue])

    const ignoreAllSuggestions = useCallback(() => {
        setSuggestions(null)
        setNotice(null)
    }, [])

    const runFetch = useCallback(async () => {
        const trimmedChannelOrProfile = channelOrProfile.trim()
        if ((fetchSource === "farcaster" || fetchSource === "both") && !trimmedChannelOrProfile) {
            setSuggestions(null)
            setNotice({
                code: "missing_farcaster_input",
                message: "Enter a channel/profile value to fetch Farcaster data.",
            })
            return
        }

        const effectiveSheetQuery = (sheetQuery || trimmedChannelOrProfile || String(getFieldValue("name") ?? "")).trim()

        setIsFetching(fetchSource === "farcaster" || fetchSource === "both")
        setIsSheetSearching(fetchSource === "sheet" || fetchSource === "both")
        resetMessages()
        setSuggestions(null)
        setNotice(null)

        try {
            let merged: SuggestionMap = {}
            let hasReliableSheetMatch = false

            if (fetchSource === "sheet" || fetchSource === "both") {
                if (!effectiveSheetQuery) {
                    setNotice({
                        code: "missing_sheet_query",
                        message: "Add a Sheet query (BID, name, ticker, channel or profile).",
                    })
                    return
                }

                const response = await fetch(
                    `/api/admin/sheet/brands?q=${encodeURIComponent(effectiveSheetQuery)}&page=1&limit=1`,
                )
                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data?.error || "Failed to search sheet brands.")
                }

                const rows = Array.isArray(data?.brands) ? (data.brands as SheetBrandResult[]) : []
                if (rows.length === 0) {
                    setNotice({
                        code: "sheet_no_results",
                        message:
                            fetchSource === "both"
                                ? "No reliable Sheet match. Continuing with Farcaster."
                                : `No reliable Sheet match for \u201c${effectiveSheetQuery}\u201d.`,
                    })
                } else {
                    const top = rows[0]
                    const isReliable =
                        top.isReliable ??
                        (typeof top.matchScore === "number" ? top.matchScore >= RELIABLE_SCORE_THRESHOLD : true)
                    if (!isReliable) {
                        setNotice({
                            code: "sheet_ambiguous",
                            message:
                                fetchSource === "both"
                                    ? "Sheet match is ambiguous. Only Farcaster suggestions were prepared."
                                    : "Sheet match is ambiguous. Refine query before applying suggestions.",
                        })
                    } else {
                        hasReliableSheetMatch = true
                        merged = mergeSuggestions(
                            merged,
                            buildSuggestionsFromSheet({
                                row: top,
                                getFieldValue,
                                categoryMapByName,
                                fallbackQueryType: queryType,
                            }),
                        )
                    }
                }
            }

            if (fetchSource === "farcaster" || fetchSource === "both") {
                const result = (await fetchFarcasterData(queryType, trimmedChannelOrProfile)) as FarcasterFetchResult
                if ("success" in result && result.success && result.data) {
                    if (result.data.canonicalHandle) {
                        onCanonicalHandle?.(result.data.canonicalHandle)
                    }
                    merged = mergeSuggestions(
                        merged,
                        buildSuggestionsFromFarcaster({
                            data: result.data,
                            getFieldValue,
                            queryType,
                        }),
                    )
                } else if ("error" in result && result.error) {
                    throw new Error(result.error)
                }
            }

            setSuggestions(Object.keys(merged).length > 0 ? merged : null)

            if (Object.keys(merged).length === 0) {
                if (!hasReliableSheetMatch && (fetchSource === "sheet" || fetchSource === "both")) {
                    setNotice({
                        code: "sheet_no_results",
                        message:
                            fetchSource === "both"
                                ? "No changes from Farcaster, and Sheet had no reliable match."
                                : `No reliable Sheet match for \u201c${effectiveSheetQuery}\u201d.`,
                    })
                } else {
                    setNotice({
                        code: "no_changes",
                        message: "No changes from selected source.",
                    })
                }
            }
        } finally {
            setIsFetching(false)
            setIsSheetSearching(false)
        }
    }, [
        categoryMapByName,
        channelOrProfile,
        fetchSource,
        getFieldValue,
        onCanonicalHandle,
        queryType,
        resetMessages,
        sheetQuery,
    ])

    return {
        fetchSource,
        setFetchSource,
        sheetQuery,
        setSheetQuery,
        isFetching,
        isSheetSearching,
        suggestions,
        setSuggestions,
        notice,
        setNotice,
        runFetch,
        applySuggestion,
        ignoreSuggestion,
        acceptAllSuggestions,
        ignoreAllSuggestions,
    }
}
