"use client"

import { useCallback, useMemo, useState, useRef, useEffect, type ChangeEvent, type DragEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { useBrandForm } from "@/hooks/useBrandForm"
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from "@/types/brand"
import { prepareBrandMetadata, createBrandDirect, checkBrandHandleExists, type PrepareMetadataPayload } from "@/lib/actions/brand-actions"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import { Coins, Image as ImageIcon, Info, Link2, Loader2, MessageSquare, Upload, UploadCloud, Wallet, X } from "lucide-react"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

const normalizeHandle = (value: string) => value.replace(/^[@/]+/, "").trim()

type UploadMode = "url" | "file"

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024
const COMPRESSED_MAX_BYTES = 1024 * 1024
const LOGO_MAX_DIMENSION = 512

const compressImage = async (file: File) => {
    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, width, height)
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/webp", 0.9)
        )
        if (!blob) return file
        const name = file.name.replace(/\.[^.]+$/, ".webp")
        return new File([blob], name, { type: "image/webp" })
    } catch {
        return file
    }
}

export function CreateOnchainPanel({
    categories,
    isActive,
}: {
    categories: CategoryOption[]
    isActive: boolean
}) {
    const [isFetching, setIsFetching] = useState(false)
    const [status, setStatus] = useState<"idle" | "validating" | "ipfs" | "signing" | "confirming">("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [logoMode, setLogoMode] = useState<UploadMode>("url")
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [logoUploadState, setLogoUploadState] = useState<"idle" | "compressing" | "uploading" | "success" | "error">("idle")
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    const initialFormData: BrandFormData = {
        ...EMPTY_BRAND_FORM,
        queryType: "0",
    }
    const { formData, setFormData, handleInputChange, queryType } = useBrandForm(initialFormData)
    const editorCategories = useMemo(
        () =>
            sortCategoriesByCanonicalOrder(
                categories.filter((category) =>
                    CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
                )
            ),
        [categories]
    )
    const statusSteps = [
        { key: "validating", label: "Validate" },
        { key: "ipfs", label: "IPFS" },
        { key: "signing", label: "Sign" },
        { key: "confirming", label: "Confirm" },
    ] as const
    const activeStepIndex = status === "idle"
        ? -1
        : statusSteps.findIndex((step) => step.key === status)
    const progressPercent = activeStepIndex < 0
        ? 0
        : Math.round(((activeStepIndex + 1) / statusSteps.length) * 100)

    const canSubmit = useMemo(() => {
        return Boolean(
            formData.name &&
            formData.categoryId &&
            formData.ownerFid &&
            formData.ownerPrimaryWallet &&
            formData.walletAddress
        )
    }, [formData])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
    }, [])

    const resetLogoState = useCallback(() => {
        setLogoUploadState("idle")
        setLogoUploadError(null)
    }, [])

    const handleLogoModeChange = (mode: UploadMode) => {
        setLogoMode(mode)
        resetLogoState()
        if (mode === "url") {
            setLogoPreview(formData.imageUrl || null)
        } else {
            setLogoPreview(null)
        }
    }

    const handleLogoFileUpload = async (file: File) => {
        resetLogoState()
        if (file.size > MAX_LOGO_SIZE_BYTES) {
            setLogoUploadError("File is too large. Max 5MB.")
            setLogoUploadState("error")
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setLogoPreview(previewUrl)
        setLogoUploadState("compressing")

        const compressed = await compressImage(file)
        if (compressed.size > COMPRESSED_MAX_BYTES) {
            setLogoUploadError("Image is still larger than 1MB after compression.")
            setLogoUploadState("error")
            return
        }

        setLogoUploadState("uploading")
        try {
            const payload = new FormData()
            payload.append("file", compressed)
            const response = await fetch("/api/admin/upload/logo", {
                method: "POST",
                body: payload,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(data?.error || "Failed to upload logo.")
            }
            const nextUrl = data?.imageUrl || data?.ipfsUrl || data?.httpUrl || ""
            setFormData((prev) => ({ ...prev, imageUrl: nextUrl }))
            setLogoUploadState("success")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload logo."
            setLogoUploadError(message)
            setLogoUploadState("error")
        }
    }

    const handleLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        await handleLogoFileUpload(file)
    }

    const handleLogoDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const file = event.dataTransfer.files?.[0]
        if (!file) return
        await handleLogoFileUpload(file)
    }

    useEffect(() => {
        return () => {
            if (logoPreview?.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview)
            }
        }
    }, [logoPreview])

    useEffect(() => {
        if (logoMode !== "url") return
        setLogoPreview(formData.imageUrl || null)
    }, [formData.imageUrl, logoMode])


    const handleFetchData = async () => {
        const value = queryType === "0" ? formData.channel : formData.profile
        if (!value) return
        setIsFetching(true)
        resetMessages()
        try {
            const result = await fetchFarcasterData(queryType, value)
            if (result.success && result.data) {
                setFormData((prev) => ({
                    ...prev,
                    name: result.data.name || prev.name,
                    description: result.data.description || prev.description,
                    imageUrl: result.data.imageUrl || prev.imageUrl,
                    followerCount: result.data.followerCount === undefined || result.data.followerCount === null
                        ? prev.followerCount
                        : String(result.data.followerCount),
                    warpcastUrl: result.data.warpcastUrl || prev.warpcastUrl,
                    url: result.data.url || prev.url,
                }))
            } else if (result.error) {
                setErrorMessage(result.error)
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch Farcaster data.")
        } finally {
            setIsFetching(false)
        }
    }

    const handleSubmit = async () => {
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

        if (chainId !== base.id) {
            await switchChainAsync({ chainId: base.id })
        }

        const queryTypeValue = Number(queryType) === 1 ? 1 : 0
        const channelOrProfile = queryTypeValue === 0 ? formData.channel : formData.profile
        const handle = normalizeHandle(channelOrProfile).toLowerCase()

        if (!handle) {
            setErrorMessage("Missing handle for onchain creation.")
            setStatus("idle")
            return
        }

        const fid = Number(formData.ownerFid)
        if (!Number.isFinite(fid) || fid <= 0) {
            setErrorMessage("Invalid owner FID.")
            setStatus("idle")
            return
        }

        if (!formData.walletAddress) {
            setErrorMessage("Wallet address is required.")
            setStatus("idle")
            return
        }

        if (!formData.ownerPrimaryWallet) {
            setErrorMessage("Owner wallet is required.")
            setStatus("idle")
            return
        }

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
            name: formData.name,
            handle,
            fid,
            walletAddress: formData.walletAddress,
            url: formData.url,
            warpcastUrl: formData.warpcastUrl,
            description: formData.description,
            categoryId: formData.categoryId ? Number(formData.categoryId) : null,
            followerCount: formData.followerCount ? Number(formData.followerCount) : null,
            imageUrl: formData.imageUrl,
            profile: formData.profile,
            channel: formData.channel,
            queryType: queryTypeValue,
            channelOrProfile,
            isEditing: false,
            tokenContractAddress: formData.tokenContractAddress || null,
            tokenTicker: formData.tokenTicker || null,
            contractAddress: formData.tokenContractAddress || null,
            ticker: formData.tokenTicker || null,
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
        const finalWallet = prepareResult.walletAddress || formData.walletAddress

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
            ownerPrimaryWallet: formData.ownerPrimaryWallet || finalWallet,
            ownerWalletFid: formData.ownerWalletFid ? Number(formData.ownerWalletFid) : null,
            categoryId: payload.categoryId ?? null,
        })

        if (!createResult.success) {
            setStatus("idle")
            setErrorMessage(createResult.message || "Failed to save brand in database.")
            return
        }

        setStatus("idle")
        setSuccessMessage("Brand created onchain and saved in DB.")
    }

    const queryTypeValue = Number(queryType) === 1 ? 1 : 0
    const channelOrProfile = queryTypeValue === 0 ? formData.channel : formData.profile

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white">Create Onchain</h2>
                    <p className="text-xs font-mono text-zinc-500">Create a brand directly onchain (admin only)</p>
                </div>
            </div>

            <div className="mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="farcaster" className="gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Farcaster
                        </TabsTrigger>
                        <TabsTrigger value="basic" className="gap-2">
                            <Info className="h-4 w-4" />
                            Basic
                        </TabsTrigger>
                        <TabsTrigger value="media" className="gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Media
                        </TabsTrigger>
                        <TabsTrigger value="wallet" className="gap-2">
                            <Wallet className="h-4 w-4" />
                            Wallet
                        </TabsTrigger>
                        <TabsTrigger value="token" className="gap-2">
                            <Coins className="h-4 w-4" />
                            Token
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="farcaster" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Query Type</label>
                                <Select
                                    value={queryType}
                                    onValueChange={(value) =>
                                        setFormData((prev) => ({ ...prev, queryType: value }))
                                    }
                                    disabled={status !== "idle"}
                                >
                                    <SelectTrigger className="mt-2 w-full">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Channel</SelectItem>
                                        <SelectItem value="1">Profile</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">
                                    {queryTypeValue === 0 ? "Channel" : "Profile"}
                                </label>
                                <Input
                                    name={queryTypeValue === 0 ? "channel" : "profile"}
                                    value={queryTypeValue === 0 ? formData.channel : formData.profile}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Owner FID</label>
                                <Input
                                    name="ownerFid"
                                    value={formData.ownerFid}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
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
                            <div className="md:col-span-2">
                                <label className="text-xs font-mono text-zinc-500">Warpcast URL</label>
                                <Input
                                    name="warpcastUrl"
                                    value={formData.warpcastUrl}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="basic" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Brand name</label>
                                <Input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Website</label>
                                <Input
                                    name="url"
                                    value={formData.url}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Category</label>
                                <Select
                                    value={formData.categoryId || "none"}
                                    onValueChange={(value) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            categoryId: value === "none" ? "" : value,
                                        }))
                                    }
                                    disabled={status !== "idle"}
                                >
                                    <SelectTrigger className="mt-2 w-full">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No category</SelectItem>
                                        {editorCategories.map((category) => (
                                            <SelectItem key={category.id} value={String(category.id)}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Follower count</label>
                                <Input
                                    name="followerCount"
                                    value={formData.followerCount}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-mono text-zinc-500">Description</label>
                                <Textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2 min-h-[120px]"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="media" className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant={logoMode === "url" ? "default" : "secondary"}
                                size="sm"
                                onClick={() => handleLogoModeChange("url")}
                                disabled={status !== "idle"}
                            >
                                <Link2 className="h-4 w-4" />
                                Use URL
                            </Button>
                            <Button
                                type="button"
                                variant={logoMode === "file" ? "default" : "secondary"}
                                size="sm"
                                onClick={() => handleLogoModeChange("file")}
                                disabled={status !== "idle"}
                            >
                                <Upload className="h-4 w-4" />
                                Upload
                            </Button>
                        </div>

                        {logoMode === "url" ? (
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Image URL</label>
                                <Input
                                    name="imageUrl"
                                    value={formData.imageUrl}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div
                                    className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-black/30 px-6 py-8 text-center text-xs text-zinc-500"
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={handleLogoDrop}
                                >
                                    <UploadCloud className="mb-3 h-8 w-8 text-zinc-500" />
                                    <p className="text-sm text-zinc-200">Drop a logo here</p>
                                    <p className="mt-1 text-xs text-zinc-500">PNG/JPG/WebP · 512px · 1MB max</p>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={status !== "idle"}
                                    >
                                        Choose file
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleLogoFileChange}
                                    />
                                </div>
                                {logoUploadState !== "idle" && (
                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                                        {logoUploadState === "compressing" && "Compressing image..."}
                                        {logoUploadState === "uploading" && "Uploading image..."}
                                        {logoUploadState === "success" && "Logo uploaded."}
                                        {logoUploadState === "error" && "Upload failed."}
                                    </div>
                                )}
                                {logoUploadError && (
                                    <div className="text-xs font-mono text-red-400">{logoUploadError}</div>
                                )}
                            </div>
                        )}

                        {logoPreview && (
                            <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/40 p-3">
                                <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-zinc-900">
                                    <Image src={logoPreview} alt="Logo preview" fill className="object-cover" unoptimized />
                                </div>
                                <div className="flex-1 text-xs font-mono text-zinc-500">
                                    Preview · {logoMode === "url" ? "Remote URL" : "Uploaded file"}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setLogoPreview(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="wallet" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Owner wallet</label>
                                <Input
                                    name="ownerPrimaryWallet"
                                    value={formData.ownerPrimaryWallet}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Owner wallet FID</label>
                                <Input
                                    name="ownerWalletFid"
                                    value={formData.ownerWalletFid}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Brand wallet</label>
                                <Input
                                    name="walletAddress"
                                    value={formData.walletAddress}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="token" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Token contract address</label>
                                <Input
                                    name="tokenContractAddress"
                                    value={formData.tokenContractAddress}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-zinc-500">Token ticker</label>
                                <Input
                                    name="tokenTicker"
                                    value={formData.tokenTicker}
                                    onChange={handleInputChange}
                                    disabled={status !== "idle"}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
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

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || status !== "idle" || !isActive}
                    className="min-w-[180px]"
                >
                    {status === "idle" ? "Create Onchain" : "Processing..."}
                </Button>
                <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                        <span>Process</span>
                        <span className="text-zinc-500">{status === "idle" ? "Ready" : status}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
                        {statusSteps.map((step, index) => {
                            const isActive = index === activeStepIndex
                            const isComplete = activeStepIndex > index
                            return (
                                <span
                                    key={step.key}
                                    className={`px-2.5 py-1 rounded border transition-colors ${
                                        isActive
                                            ? "border-white/60 bg-white/10 text-white"
                                            : isComplete
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                : "border-zinc-800 text-zinc-500"
                                    }`}
                                >
                                    {step.label}
                                </span>
                            )
                        })}
                    </div>
                    <div className="h-2 w-full rounded-full border border-zinc-800 bg-black/50">
                        <div
                            className="h-full rounded-full bg-white/80 transition-all"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
