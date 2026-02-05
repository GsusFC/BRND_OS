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
    const ownerFidValue = form.watch("ownerFid")
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
        return Boolean(nameValue && categoryValue && ownerFidValue && address)
    }, [nameValue, categoryValue, ownerFidValue, address])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
    }, [])

    const handleFetchData = async () => {
        const value = queryType === "0" ? form.getValues("channel") : form.getValues("profile")
        if (!value) return
        setIsFetching(true)
        resetMessages()
        try {
            const result = await fetchFarcasterData(queryType, value)
            if (result.success && result.data) {
                form.setValue("name", result.data.name || form.getValues("name"))
                form.setValue("description", result.data.description || form.getValues("description"))
                form.setValue("imageUrl", result.data.imageUrl || form.getValues("imageUrl"))
                form.setValue(
                    "followerCount",
                    result.data.followerCount === undefined || result.data.followerCount === null
                        ? form.getValues("followerCount")
                        : String(result.data.followerCount)
                )
                form.setValue("warpcastUrl", result.data.warpcastUrl || form.getValues("warpcastUrl"))
                form.setValue("url", result.data.url || form.getValues("url"))
            } else if (result.error) {
                setErrorMessage(result.error)
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch Farcaster data.")
        } finally {
            setIsFetching(false)
        }
    }

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

        const fid = Number(values.ownerFid)
        if (!Number.isFinite(fid) || fid <= 0) {
            setErrorMessage("Invalid owner FID.")
            setStatus("idle")
            return
        }

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
                    <BrandFormTabs value={activeTab} onValueChange={setActiveTab}>

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
                                <FormField
                                    control={form.control}
                                    name="ownerFid"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-mono text-zinc-500">
                                                {queryType === "1" ? "Brand FID (Profile)" : "Owner FID (Channel)"}
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
                                        disabled={status !== "idle" || isFetching || !channelOrProfile}
                                    >
                                        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch Farcaster"}
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
                                        </FormItem>
                                    )}
                                />
                            </div>
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
