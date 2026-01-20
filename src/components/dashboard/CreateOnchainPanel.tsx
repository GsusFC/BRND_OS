"use client"

import { useCallback, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { prepareBrandMetadata, createBrandDirect, type PrepareMetadataPayload } from "@/lib/actions/brand-actions"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"

type CategoryOption = {
    id: number
    name: string
}

const EDITOR_CATEGORIES = [
    "Infra",
    "Social",
    "Community",
    "Finance",
    "Game",
    "AI",
    "Media",
] as const

type FormState = {
    name: string
    url: string
    warpcastUrl: string
    description: string
    categoryId: string
    followerCount: string
    imageUrl: string
    profile: string
    channel: string
    queryType: string
    ownerFid: string
    ownerPrimaryWallet: string
    walletAddress: string
}

const normalizeHandle = (value: string) => value.replace(/^[@/]+/, "").trim()

export function CreateOnchainPanel({
    categories,
    isActive,
}: {
    categories: CategoryOption[]
    isActive: boolean
}) {
    const editorCategories = useMemo(
        () => categories.filter((category) => EDITOR_CATEGORIES.includes(category.name as (typeof EDITOR_CATEGORIES)[number])),
        [categories]
    )

    const [queryType, setQueryType] = useState("0")
    const [isFetching, setIsFetching] = useState(false)
    const [status, setStatus] = useState<"idle" | "validating" | "ipfs" | "signing" | "confirming">("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

    const [formData, setFormData] = useState<FormState>({
        name: "",
        url: "",
        warpcastUrl: "",
        description: "",
        categoryId: "",
        followerCount: "",
        imageUrl: "",
        profile: "",
        channel: "",
        queryType: "0",
        ownerFid: "",
        ownerPrimaryWallet: "",
        walletAddress: "",
    })

    const canSubmit = useMemo(() => {
        return Boolean(
            formData.name &&
            formData.categoryId &&
            formData.ownerFid &&
            formData.ownerPrimaryWallet &&
            formData.walletAddress
        )
    }, [formData])

    const setField = (name: keyof FormState, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setField(name as keyof FormState, value)
    }

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
    }, [])

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

        if (!isConnected || !address) {
            setErrorMessage("Connect your wallet to continue.")
            return
        }

        if (isAdminError) {
            setErrorMessage("Unable to verify admin status onchain.")
            return
        }

        if (isAdmin === undefined) {
            setErrorMessage("Admin status not loaded yet. Please try again.")
            return
        }

        if (!isAdmin) {
            setErrorMessage("This wallet is not authorized to create brands onchain.")
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
            return
        }

        const fid = Number(formData.ownerFid)
        if (!Number.isFinite(fid) || fid <= 0) {
            setErrorMessage("Invalid owner FID.")
            return
        }

        if (!formData.walletAddress) {
            setErrorMessage("Wallet address is required.")
            return
        }

        if (!formData.ownerPrimaryWallet) {
            setErrorMessage("Owner wallet is required.")
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

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">Create Onchain</h2>
                    <p className="text-xs font-mono text-zinc-500">Create a brand directly onchain (admin only)</p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchData}
                    disabled={isFetching || (!formData.channel && !formData.profile)}
                >
                    {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Auto-Fill
                </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Type *</label>
                    <select
                        name="queryType"
                        value={queryType}
                        onChange={(e) => setQueryType(e.target.value)}
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-2 px-3 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    >
                        <option value="0">Channel</option>
                        <option value="1">Profile</option>
                    </select>
                </div>

                {queryType === "0" ? (
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-mono text-zinc-500 mb-2">Channel *</label>
                        <Input name="channel" value={formData.channel} onChange={handleInputChange} placeholder="e.g. farcaster" />
                    </div>
                ) : (
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-mono text-zinc-500 mb-2">Profile *</label>
                        <Input name="profile" value={formData.profile} onChange={handleInputChange} placeholder="e.g. dwr" />
                    </div>
                )}

                <div className="sm:col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Name *</label>
                    <Input name="name" value={formData.name} onChange={handleInputChange} />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Category *</label>
                    <select
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleInputChange}
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-2 px-3 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    >
                        <option value="" disabled>Select a category</option>
                        {editorCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Owner FID *</label>
                    <Input name="ownerFid" type="number" value={formData.ownerFid} onChange={handleInputChange} />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Owner Wallet *</label>
                    <Input name="ownerPrimaryWallet" value={formData.ownerPrimaryWallet} onChange={handleInputChange} placeholder="0x..." />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Wallet Address (gating) *</label>
                    <Input name="walletAddress" value={formData.walletAddress} onChange={handleInputChange} placeholder="0x..." />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-2 px-3 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Website</label>
                    <Input name="url" value={formData.url} onChange={handleInputChange} placeholder="https://..." />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Farcaster URL</label>
                    <Input name="warpcastUrl" value={formData.warpcastUrl} onChange={handleInputChange} placeholder="https://farcaster.xyz/..." />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Logo URL</label>
                    <Input name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." />
                </div>

                <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">Follower Count</label>
                    <Input name="followerCount" type="number" value={formData.followerCount} onChange={handleInputChange} min="0" />
                </div>
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

            <div className="mt-6 flex items-center justify-between">
                <div className="text-xs font-mono text-zinc-500">
                    Status: {status === "idle" ? "Ready" : status}
                </div>
                <Button onClick={handleSubmit} disabled={!canSubmit || status !== "idle" || !isActive}>
                    {status === "idle" ? "Create Onchain" : "Processing..."}
                </Button>
            </div>
        </div>
    )
}
