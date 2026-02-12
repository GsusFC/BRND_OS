"use client"

import { useCallback, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { BrandFormTabs } from "@/components/brands/forms"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import {
    prepareBrandMetadata,
    createBrandDirect,
    checkBrandHandleExists,
    type PrepareMetadataPayload,
} from "@/lib/actions/brand-actions"
import { brandFormSchema, type BrandFormValues, toQueryType } from "@/lib/validations/brand-form"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import { EMPTY_BRAND_FORM, type CategoryOption } from "@/types/brand"
import { LogoUploader } from "@/components/dashboard/applications/shared/LogoUploader"
import { OnchainProgress, type OnchainStatus } from "@/components/dashboard/applications/shared/OnchainProgress"

const normalizeHandle = (value: string) => value.replace(/^[@/]+/, "").trim()
const normalizeProfile = (value?: string | null) => (value ?? "").replace(/^@+/, "").trim()
const normalizeChannel = (value?: string | null) => {
    const clean = (value ?? "").trim()
    if (!clean) return ""
    return clean.startsWith("/") ? clean : `/${clean}`
}
const normalizeTicker = (value?: string | null) => (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")

type SheetBrandResult = {
    bid: number
    name: string
    url: string | null
    description: string | null
    iconLogoUrl: string | null
    ticker: string | null
    category: string | null
    profile: string | null
    channel: string | null
    guardianFid: number | null
    founder: string | null
}

type FetchSource = "farcaster" | "sheet" | "both"

function FarcasterSuggestionField({
    suggestedValue,
    onAccept,
    onIgnore,
}: {
    suggestedValue: string | number | null | undefined
    onAccept: () => void
    onIgnore: () => void
}) {
    return (
        <div className="mt-1.5 flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-0.5 duration-200">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.1em] font-bold shrink-0">✨ Suggestion</span>
                <span className="text-sm text-white truncate font-medium">
                    {String(suggestedValue || "-")}
                </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    onClick={onAccept}
                    className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                >
                    Apply
                </button>
                <button
                    type="button"
                    onClick={onIgnore}
                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    ×
                </button>
            </div>
        </div>
    )
}

export function CreateOnchainPanel({
    categories,
    isActive,
}: {
    categories: CategoryOption[]
    isActive: boolean
}) {
    const [isFetching, setIsFetching] = useState(false)
    const [status, setStatus] = useState<OnchainStatus>("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [fetchSource, setFetchSource] = useState<FetchSource>("farcaster")
    const [farcasterSuggestions, setFarcasterSuggestions] = useState<Partial<BrandFormValues> | null>(null)
    const [farcasterNotice, setFarcasterNotice] = useState<string | null>(null)
    const [sheetQuery, setSheetQuery] = useState("")
    const [isSheetSearching, setIsSheetSearching] = useState(false)

    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChainAsync } = useSwitchChain()
    const { writeContractAsync } = useWriteContract()
    const { data: isAdmin, isError: isAdminError } = useReadContract({
        address: BRND_CONTRACT_ADDRESS,
        abi: BRND_CONTRACT_ABI,
        functionName: "isAdmin",
        args: address ? [address] : undefined,
        query: { enabled: Boolean(address) },
    })

    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandFormSchema),
        defaultValues: {
            ...EMPTY_BRAND_FORM,
            queryType: "0",
        },
        mode: "onBlur",
    })

    const queryType = toQueryType(form.watch("queryType"))
    const imageUrl = form.watch("imageUrl")
    const nameValue = form.watch("name")
    const categoryValue = form.watch("categoryId")
    const channelOrProfile = queryType === "0" ? form.watch("channel") : form.watch("profile")

    const editorCategories = useMemo(
        () =>
            sortCategoriesByCanonicalOrder(
                categories.filter((category) =>
                    CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
                )
            ),
        [categories]
    )

    const canSubmit = useMemo(() => {
        return Boolean(nameValue && categoryValue && address)
    }, [nameValue, categoryValue, address])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
    }, [])

    const categoryMapByName = useMemo(() => {
        const map = new Map<string, string>()
        for (const category of editorCategories) {
            map.set(category.name.trim().toLowerCase(), String(category.id))
        }
        return map
    }, [editorCategories])

    const buildSheetSuggestions = useCallback((brand: SheetBrandResult): Partial<BrandFormValues> => {
        const profile = normalizeProfile(brand.profile)
        const channel = normalizeChannel(brand.channel)
        const nextQueryType: BrandFormValues["queryType"] = channel ? "0" : profile ? "1" : queryType
        const categoryId = categoryMapByName.get((brand.category ?? "").trim().toLowerCase()) ?? form.getValues("categoryId")
        const ticker = normalizeTicker(brand.ticker)

        const candidate: Partial<BrandFormValues> = {
            name: brand.name || undefined,
            description: brand.description || undefined,
            url: brand.url || undefined,
            imageUrl: brand.iconLogoUrl || undefined,
            categoryId: categoryId || undefined,
            tokenTicker: ticker || undefined,
            profile: profile || undefined,
            channel: channel || undefined,
            queryType: nextQueryType,
            ownerWalletFid: brand.guardianFid && brand.guardianFid > 0 ? String(brand.guardianFid) : undefined,
        }
        const out: Partial<BrandFormValues> = {}
        for (const key of Object.keys(candidate) as Array<keyof BrandFormValues>) {
            const suggested = candidate[key]
            if (suggested === undefined || suggested === null) continue
            const current = String(form.getValues(key) ?? "")
            const nextValue = String(suggested ?? "")
            if (current !== nextValue) {
                if (key === "queryType") {
                    out.queryType = toQueryType(nextValue)
                } else {
                    out[key] = suggested as BrandFormValues[typeof key]
                }
            }
        }
        return out
    }, [categoryMapByName, form, queryType])

    const handleFetchData = async () => {
        const value = queryType === "0" ? form.getValues("channel") : form.getValues("profile")
        if ((fetchSource === "farcaster" || fetchSource === "both") && !value) {
            setFarcasterSuggestions(null)
            setFarcasterNotice("Enter a value to fetch Farcaster data.")
            return
        }
        const effectiveSheetQuery = (sheetQuery || value || form.getValues("name") || "").trim()

        setIsFetching(fetchSource === "farcaster" || fetchSource === "both")
        setIsSheetSearching(fetchSource === "sheet" || fetchSource === "both")
        resetMessages()
        setFarcasterSuggestions(null)
        setFarcasterNotice(null)
        try {
            const suggestions: Partial<BrandFormValues> = {}

            if (fetchSource === "sheet" || fetchSource === "both") {
                if (!effectiveSheetQuery) {
                    setFarcasterNotice("Add a Sheet query (or channel/profile) to fetch from Google Sheet.")
                    return
                }
                const sheetResponse = await fetch(`/api/admin/sheet/brands?q=${encodeURIComponent(effectiveSheetQuery)}&page=1&limit=1`)
                const sheetData = await sheetResponse.json()
                if (!sheetResponse.ok) {
                    throw new Error(sheetData?.error || "Failed to search sheet brands.")
                }
                const rows = Array.isArray(sheetData?.brands) ? (sheetData.brands as SheetBrandResult[]) : []
                if (rows.length > 0) {
                    Object.assign(suggestions, buildSheetSuggestions(rows[0]))
                }
            }

            if (fetchSource === "farcaster" || fetchSource === "both") {
                const result = await fetchFarcasterData(queryType, value ?? "")
                if (result.success && result.data) {
                    type SuggestionKey = "name" | "description" | "imageUrl" | "followerCount" | "warpcastUrl" | "url"
                    const suggestionKeys: SuggestionKey[] = ["name", "description", "imageUrl", "followerCount", "warpcastUrl", "url"]
                    const candidate: Partial<Record<SuggestionKey, BrandFormValues[SuggestionKey]>> = {
                        name: result.data.name ?? undefined,
                        description: result.data.description ?? undefined,
                        imageUrl: result.data.imageUrl ?? undefined,
                        followerCount:
                            result.data.followerCount === undefined || result.data.followerCount === null
                                ? undefined
                                : String(result.data.followerCount),
                        warpcastUrl: result.data.warpcastUrl ?? undefined,
                        url: result.data.url ?? undefined,
                    }
                    suggestionKeys.forEach((key) => {
                        const suggested = candidate[key]
                        if (suggested === undefined || suggested === null) return
                        const current = String(form.getValues(key) ?? "")
                        const nextValue = String(suggested ?? "")
                        if (current !== nextValue) {
                            // In "both", Farcaster acts as enrichment layer over sheet for shared fields
                            suggestions[key] = suggested as BrandFormValues[SuggestionKey]
                        }
                    })
                } else if (result.error) {
                    setErrorMessage(result.error)
                }
            }

            setFarcasterSuggestions(suggestions)
            if (Object.keys(suggestions).length === 0) {
                setFarcasterNotice("No changes from selected source.")
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch Farcaster data.")
        } finally {
            setIsFetching(false)
            setIsSheetSearching(false)
        }
    }

    const applyFarcasterSuggestion = useCallback((key: keyof BrandFormValues) => {
        if (!farcasterSuggestions || farcasterSuggestions[key] === undefined) return
        form.setValue(key, farcasterSuggestions[key] as BrandFormValues[typeof key], { shouldDirty: true, shouldTouch: true })
        setFarcasterSuggestions((prev) => {
            if (!prev) return null
            const next = { ...prev }
            delete next[key]
            return Object.keys(next).length > 0 ? next : null
        })
    }, [farcasterSuggestions, form])

    const ignoreFarcasterSuggestion = useCallback((key: keyof BrandFormValues) => {
        setFarcasterSuggestions((prev) => {
            if (!prev) return null
            const next = { ...prev }
            delete next[key]
            return Object.keys(next).length > 0 ? next : null
        })
    }, [])

    const handleAcceptAllFarcasterSuggestions = useCallback(() => {
        if (!farcasterSuggestions) return
        for (const key of Object.keys(farcasterSuggestions) as Array<keyof BrandFormValues>) {
            form.setValue(key, farcasterSuggestions[key] as BrandFormValues[typeof key], { shouldDirty: true, shouldTouch: true })
        }
        setFarcasterSuggestions(null)
        setFarcasterNotice(null)
    }, [farcasterSuggestions, form])

    const handleIgnoreAllFarcasterSuggestions = useCallback(() => {
        setFarcasterSuggestions(null)
        setFarcasterNotice(null)
    }, [])

    const handleSubmit = form.handleSubmit(async (values) => {
        resetMessages()
        setStatus("validating")

        if (!isConnected || !address) {
            setErrorMessage("Connect your wallet to continue.")
            setStatus("idle")
            return
        }

        if (isAdminError) {
            setErrorMessage("Unable to verify admin status onchain.")
            setStatus("idle")
            return
        }

        if (isAdmin === undefined) {
            setErrorMessage("Admin status not loaded yet. Please try again.")
            setStatus("idle")
            return
        }

        if (!isAdmin) {
            setErrorMessage("This wallet is not authorized to create brands onchain.")
            setStatus("idle")
            return
        }

        if (!address) {
            setErrorMessage("Connect your admin wallet to continue.")
            setStatus("idle")
            return
        }

        if (chainId !== base.id) {
            await switchChainAsync({ chainId: base.id })
        }

        const queryTypeValue = values.queryType === "1" ? 1 : 0
        const channelOrProfileValue = queryTypeValue === 0 ? values.channel : values.profile
        const handle = normalizeHandle(channelOrProfileValue || "").toLowerCase()

        if (!handle) {
            setErrorMessage("Missing handle for onchain creation.")
            setStatus("idle")
            return
        }

        const parsedOwnerFid = Number(values.ownerFid)
        const parsedOwnerWalletFid = Number(values.ownerWalletFid)
        const fid =
            Number.isFinite(parsedOwnerFid) && parsedOwnerFid > 0
                ? parsedOwnerFid
                : Number.isFinite(parsedOwnerWalletFid) && parsedOwnerWalletFid > 0
                    ? parsedOwnerWalletFid
                    : 0

        const connectedWallet = address.trim()

        const dbCheck = await checkBrandHandleExists(handle)
        if (!dbCheck.success) {
            setErrorMessage(dbCheck.message || "Unable to validate handle in database.")
            setStatus("idle")
            return
        }
        if (dbCheck.exists) {
            setErrorMessage("Handle already exists in database.")
            setStatus("idle")
            return
        }

        try {
            const response = await fetch(`/api/admin/indexer/brands?q=${encodeURIComponent(handle)}&page=1&limit=10`)
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || "Failed to validate handle in indexer.")
            }
            const normalizedHandle = handle.toLowerCase()
            const hasExactMatch = Array.isArray(data?.brands)
                ? data.brands.some((brand: { handle?: string }) => brand.handle?.toLowerCase() === normalizedHandle)
                : false
            if (hasExactMatch) {
                setErrorMessage("Handle already exists onchain.")
                setStatus("idle")
                return
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to validate handle onchain.")
            setStatus("idle")
            return
        }

        const payload: PrepareMetadataPayload = {
            name: values.name,
            handle,
            fid,
            walletAddress: connectedWallet,
            url: values.url ?? "",
            warpcastUrl: values.warpcastUrl ?? "",
            description: values.description ?? "",
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            followerCount: values.followerCount ? Number(values.followerCount) : null,
            imageUrl: values.imageUrl ?? "",
            profile: values.profile ?? "",
            channel: values.channel ?? "",
            queryType: queryTypeValue,
            channelOrProfile: channelOrProfileValue || "",
            isEditing: false,
            tokenContractAddress: values.tokenContractAddress || null,
            tokenTicker: values.tokenTicker || null,
            contractAddress: values.tokenContractAddress || null,
            ticker: values.tokenTicker || null,
        }

        setStatus("ipfs")
        const prepareResult = await prepareBrandMetadata(payload)
        if (!prepareResult.valid || !prepareResult.metadataHash) {
            setStatus("idle")
            setErrorMessage(prepareResult.message || "Failed to prepare brand metadata.")
            return
        }

        const finalHandle = prepareResult.handle || handle
        const finalFid = prepareResult.fid ?? fid
        const finalWallet = prepareResult.walletAddress || connectedWallet

        setStatus("signing")
        const hash = await writeContractAsync({
            address: BRND_CONTRACT_ADDRESS,
            abi: BRND_CONTRACT_ABI,
            functionName: "createBrand",
            args: [finalHandle, prepareResult.metadataHash, BigInt(finalFid), finalWallet as `0x${string}`],
        })

        setStatus("confirming")
        const publicClient = createPublicClient({
            chain: base,
            transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
        })
        await publicClient.waitForTransactionReceipt({ hash })

        const createResult = await createBrandDirect({
            ...payload,
            handle: finalHandle,
            fid: finalFid,
            walletAddress: finalWallet,
            ownerPrimaryWallet: values.ownerPrimaryWallet || finalWallet,
            ownerWalletFid: values.ownerWalletFid ? Number(values.ownerWalletFid) : null,
            categoryId: payload.categoryId ?? null,
        })

        if (!createResult.success) {
            setStatus("idle")
            setErrorMessage(createResult.message || "Failed to save brand in database.")
            return
        }

        setStatus("idle")
        setSuccessMessage("Brand created onchain and saved in DB.")
    })

    return (
        <Form {...form}>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-white">Create Onchain</h2>
                        <p className="text-xs font-mono text-zinc-500">Create a brand directly onchain (admin only)</p>
                    </div>
                </div>

                <div className="mt-6">
                    <BrandFormTabs value={activeTab} onValueChange={setActiveTab} showSheetTab={false}>

                        <TabsContent value="farcaster" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="queryType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Query Type</FormLabel>
                                            <FormControl>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="mt-2 w-full">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">Channel</SelectItem>
                                                        <SelectItem value="1">Profile</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div>
                                    <label className="text-xs font-mono text-zinc-500">Fetch Source</label>
                                    <Select value={fetchSource} onValueChange={(value) => setFetchSource(value as FetchSource)}>
                                        <SelectTrigger className="mt-2 w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="farcaster">Farcaster</SelectItem>
                                            <SelectItem value="sheet">Google Sheet</SelectItem>
                                            <SelectItem value="both">Both (Sheet + Farcaster)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FormField
                                    control={form.control}
                                    name={queryType === "0" ? "channel" : "profile"}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">
                                                {queryType === "0" ? "Channel" : "Profile"}
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {(fetchSource === "sheet" || fetchSource === "both") && (
                                    <div>
                                        <label className="text-xs font-mono text-zinc-500">Sheet Query</label>
                                        <Input
                                            value={sheetQuery}
                                            onChange={(event) => setSheetQuery(event.target.value)}
                                            className="mt-2"
                                            placeholder="BID, name, ticker, channel, profile"
                                            disabled={status !== "idle"}
                                        />
                                    </div>
                                )}
                                <FormField
                                    control={form.control}
                                    name="ownerFid"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">
                                                {queryType === "1" ? "Brand FID (Profile, optional)" : "Owner FID (Channel, optional)"}
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex items-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleFetchData}
                                        disabled={status !== "idle" || isFetching || isSheetSearching || ((fetchSource === "farcaster" || fetchSource === "both") && !channelOrProfile) || Object.keys(farcasterSuggestions || {}).length > 0}
                                    >
                                        {isFetching || isSheetSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : fetchSource === "sheet" ? "Fetch Sheet" : fetchSource === "both" ? "Fetch Both" : "Fetch Farcaster"}
                                    </Button>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="warpcastUrl"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel className="text-xs font-mono text-zinc-500">Warpcast URL</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                            {farcasterSuggestions?.warpcastUrl && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.warpcastUrl}
                                                    onAccept={() => applyFarcasterSuggestion("warpcastUrl")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("warpcastUrl")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="followerCount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Follower Count</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                            {farcasterSuggestions?.followerCount && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.followerCount}
                                                    onAccept={() => applyFarcasterSuggestion("followerCount")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("followerCount")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {farcasterNotice && (
                                <p className="text-[11px] font-mono text-zinc-500">{farcasterNotice}</p>
                            )}

                            {farcasterSuggestions && Object.keys(farcasterSuggestions).length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        onClick={handleAcceptAllFarcasterSuggestions}
                                        disabled={status !== "idle"}
                                    >
                                        Accept All Suggestions
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleIgnoreAllFarcasterSuggestions}
                                        disabled={status !== "idle"}
                                    >
                                        Ignore All
                                    </Button>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Brand name</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                            {farcasterSuggestions?.name && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.name}
                                                    onAccept={() => applyFarcasterSuggestion("name")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("name")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="url"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Website</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                            {farcasterSuggestions?.url && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.url}
                                                    onAccept={() => applyFarcasterSuggestion("url")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("url")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Category</FormLabel>
                                            <FormControl>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="mt-2 w-full" disabled={status !== "idle"}>
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {editorCategories.map((category) => (
                                                            <SelectItem key={category.id} value={String(category.id)}>
                                                                {category.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel className="text-xs font-mono text-zinc-500">Description</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} className="mt-2 min-h-[120px]" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                            {farcasterSuggestions?.description && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.description}
                                                    onAccept={() => applyFarcasterSuggestion("description")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("description")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="media" className="space-y-4">
                            <FormField
                                control={form.control}
                                name="imageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Logo</FormLabel>
                                        <FormControl>
                                            <LogoUploader
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                disabled={status !== "idle"}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        {farcasterSuggestions?.imageUrl && (
                                            <FarcasterSuggestionField
                                                suggestedValue={farcasterSuggestions.imageUrl}
                                                onAccept={() => applyFarcasterSuggestion("imageUrl")}
                                                onIgnore={() => ignoreFarcasterSuggestion("imageUrl")}
                                            />
                                        )}
                                    </FormItem>
                                )}
                            />
                        </TabsContent>

                        <TabsContent value="wallet" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="ownerPrimaryWallet"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Owner wallet</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ownerWalletFid"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Owner wallet FID</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="token" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="tokenContractAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Token contract address</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="tokenTicker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Token ticker</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={status !== "idle"} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </TabsContent>
                    </BrandFormTabs>
                </div>

                {errorMessage && (
                    <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs font-mono text-red-400">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-xs font-mono text-emerald-300">
                        {successMessage}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit || status !== "idle" || !isActive}
                        className="min-w-[180px]"
                    >
                        {status === "idle" ? "Create Onchain" : "Processing..."}
                    </Button>
                    <OnchainProgress status={status} className="flex-1 min-w-[200px]" />
                </div>
            </div>
        </Form>
    )
}
