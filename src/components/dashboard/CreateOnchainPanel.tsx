"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import {
    prepareBrandMetadata,
    createBrandDirect,
    type PrepareMetadataPayload,
} from "@/lib/actions/brand-actions"
import { toCanonicalHandle } from "@/lib/farcaster/normalize-identifiers"
import { brandFormSchema, type BrandFormValues, toQueryType } from "@/lib/validations/brand-form"
import {
    normalizeTokenTickerInput,
    TOKEN_TICKER_REGEX,
    TOKEN_TICKER_VALIDATION_MESSAGE,
} from "@/lib/tokens/normalize-token-ticker"
import {
    normalizeTokenContractAddressInput,
    isValidTokenContractAddress,
    TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE,
} from "@/lib/tokens/normalize-token-contract"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import { EMPTY_BRAND_FORM, type CategoryOption } from "@/types/brand"
import { LogoUploader } from "@/components/dashboard/applications/shared/LogoUploader"
import { OnchainProgress, type OnchainStatus } from "@/components/dashboard/applications/shared/OnchainProgress"
import { OnchainFetchModule } from "@/components/dashboard/onchain-fetch/OnchainFetchModule"
import { useOnchainFetch } from "@/components/dashboard/onchain-fetch/useOnchainFetch"

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
    const [status, setStatus] = useState<OnchainStatus>("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [manualHandle, setManualHandle] = useState("")
    const [isHandleManuallyEdited, setIsHandleManuallyEdited] = useState(false)

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
    const isUserRejectedSignature = (error: unknown) => {
        if (!error || typeof error !== "object") return false
        const err = error as {
            code?: number
            name?: string
            message?: string
            cause?: { code?: number; name?: string; message?: string }
        }
        const message = [err.message, err.cause?.message].filter(Boolean).join(" ").toLowerCase()
        const code = err.code ?? err.cause?.code
        const name = err.name ?? err.cause?.name
        return (
            code === 4001 ||
            name === "UserRejectedRequestError" ||
            message.includes("user cancelled") ||
            message.includes("user rejected") ||
            message.includes("request rejected") ||
            message.includes("denied transaction")
        )
    }

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
    const channelOrProfile = queryType === "0" ? form.watch("channel") : form.watch("profile")

    useEffect(() => {
        if (isHandleManuallyEdited) return
        try {
            const next = toCanonicalHandle({ queryType, value: channelOrProfile || "" })
            setManualHandle(next)
        } catch {
            setManualHandle("")
        }
    }, [channelOrProfile, isHandleManuallyEdited, queryType])

    const editorCategories = useMemo(
        () =>
            sortCategoriesByCanonicalOrder(
                categories.filter((category) =>
                    CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
                )
            ),
        [categories]
    )

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

    const {
        fetchSource,
        setFetchSource,
        sheetQuery,
        setSheetQuery,
        isFetching,
        isSheetSearching,
        suggestions: farcasterSuggestions,
        notice: farcasterNotice,
        runFetch,
        applySuggestion: applyFarcasterSuggestion,
        ignoreSuggestion: ignoreFarcasterSuggestion,
        acceptAllSuggestions: handleAcceptAllFarcasterSuggestions,
        ignoreAllSuggestions: handleIgnoreAllFarcasterSuggestions,
    } = useOnchainFetch({
        queryType,
        channelOrProfile: channelOrProfile ?? "",
        categoryMapByName,
        getFieldValue: (key) => form.getValues(key),
        setFieldValue: (key, value, options) =>
            form.setValue(key as keyof BrandFormValues, value as BrandFormValues[keyof BrandFormValues], {
                shouldDirty: options?.dirty ?? true,
                shouldTouch: options?.dirty ?? true,
            }),
        resetMessages,
        onCanonicalHandle: (handle) => {
            if (!isHandleManuallyEdited) setManualHandle(handle)
        },
    })

    const handleFetchData = useCallback(async () => {
        try {
            await runFetch()
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch data.")
        }
    }, [runFetch])

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

        try {
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id })
            }

            const queryTypeValue = values.queryType === "1" ? 1 : 0
            const channelOrProfileValue = queryTypeValue === 0 ? values.channel : values.profile
            let handle = ""
            try {
                handle = toCanonicalHandle({ queryType: queryTypeValue, value: manualHandle || channelOrProfileValue || "" })
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : "Invalid handle format.")
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
            const normalizedTokenContractAddress = normalizeTokenContractAddressInput(values.tokenContractAddress)
            const normalizedTokenTicker = normalizeTokenTickerInput(values.tokenTicker)
            const normalizedTickerTokenId = values.tickerTokenId?.trim() || ""

            if (!isValidTokenContractAddress(normalizedTokenContractAddress)) {
                setErrorMessage(TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE)
                setStatus("idle")
                return
            }

            if (normalizedTokenTicker && !TOKEN_TICKER_REGEX.test(normalizedTokenTicker)) {
                setErrorMessage(TOKEN_TICKER_VALIDATION_MESSAGE)
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
                tokenContractAddress: normalizedTokenContractAddress || null,
                tokenTicker: normalizedTokenTicker || null,
                contractAddress: normalizedTokenContractAddress || null,
                ticker: normalizedTokenTicker || null,
                tickerTokenId: normalizedTickerTokenId || null,
            }

            setStatus("ipfs")
            const prepareResult = await prepareBrandMetadata(payload)
            if (!prepareResult.valid || !prepareResult.metadataHash) {
                setErrorMessage(prepareResult.message || "Failed to prepare brand metadata.")
                return
            }

            const finalHandle = prepareResult.handle || handle
            const finalFid = prepareResult.fid ?? fid
            const finalWallet = (prepareResult.walletAddress || connectedWallet).trim()

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
                setErrorMessage(createResult.message || "Failed to save brand in database.")
                return
            }

            setSuccessMessage("Brand created onchain and saved in DB.")
        } catch (error) {
            console.error("Create Onchain error:", error)
            if (isUserRejectedSignature(error)) {
                setErrorMessage("Signature request was rejected in your wallet.")
                return
            }
            setErrorMessage(error instanceof Error ? error.message : "Failed to create brand onchain.")
        } finally {
            setStatus("idle")
        }
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
                                            {farcasterSuggestions?.queryType && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.queryType === "1" ? "Profile" : "Channel"}
                                                    onAccept={() => applyFarcasterSuggestion("queryType")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("queryType")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
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
                                            {farcasterSuggestions?.ownerFid && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.ownerFid}
                                                    onAccept={() => applyFarcasterSuggestion("ownerFid")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("ownerFid")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <div>
                                    <label className="text-xs font-mono text-zinc-500">Handle (required onchain)</label>
                                    <Input
                                        value={manualHandle}
                                        onChange={(event) => {
                                            setManualHandle(event.target.value)
                                            setIsHandleManuallyEdited(true)
                                        }}
                                        onBlur={() => {
                                            try {
                                                setManualHandle(toCanonicalHandle({ queryType, value: manualHandle }))
                                            } catch {
                                                // Keep user input untouched to allow correction
                                            }
                                        }}
                                        className="mt-2"
                                        placeholder="e.g. pixybase"
                                        disabled={status !== "idle"}
                                    />
                                    <p className="mt-1 text-[11px] font-mono text-zinc-500">
                                        This is the handle used for onchain creation.
                                    </p>
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
                                            {queryType === "0" && farcasterSuggestions?.channel && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.channel}
                                                    onAccept={() => applyFarcasterSuggestion("channel")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("channel")}
                                                />
                                            )}
                                            {queryType === "1" && farcasterSuggestions?.profile && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.profile}
                                                    onAccept={() => applyFarcasterSuggestion("profile")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("profile")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <OnchainFetchModule
                                    className="md:col-span-2"
                                    fetchSource={fetchSource}
                                    setFetchSource={setFetchSource}
                                    sheetQuery={sheetQuery}
                                    setSheetQuery={setSheetQuery}
                                    onFetch={handleFetchData}
                                    disabled={status !== "idle"}
                                    isFetching={isFetching}
                                    isSheetSearching={isSheetSearching}
                                    channelOrProfile={channelOrProfile ?? ""}
                                    hasSuggestions={Boolean(farcasterSuggestions && Object.keys(farcasterSuggestions).length > 0)}
                                    notice={farcasterNotice}
                                    onAcceptAll={handleAcceptAllFarcasterSuggestions}
                                    onIgnoreAll={handleIgnoreAllFarcasterSuggestions}
                                />
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

                        </TabsContent>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
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
                                            <FormLabel className="text-xs font-mono text-zinc-500">Guardian wallet</FormLabel>
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
                                            <FormLabel className="text-xs font-mono text-zinc-500">Guardian fid</FormLabel>
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
                                            {farcasterSuggestions?.tokenContractAddress && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.tokenContractAddress}
                                                    onAccept={() => applyFarcasterSuggestion("tokenContractAddress")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("tokenContractAddress")}
                                                />
                                            )}
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
                                            {farcasterSuggestions?.tokenTicker && (
                                                <FarcasterSuggestionField
                                                    suggestedValue={farcasterSuggestions.tokenTicker}
                                                    onAccept={() => applyFarcasterSuggestion("tokenTicker")}
                                                    onIgnore={() => ignoreFarcasterSuggestion("tokenTicker")}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="tickerTokenId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">Ticker token ID</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    className="mt-2 font-mono"
                                                    disabled={status !== "idle"}
                                                    placeholder="eip155:8453/erc20:0x..."
                                                />
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
                        disabled={status !== "idle" || !isActive}
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
