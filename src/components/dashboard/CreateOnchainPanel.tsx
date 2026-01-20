"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { BasicInfoSection, FarcasterSection, WebMediaSection, WalletSection, TokenInfoSection } from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from "@/types/brand"
import { prepareBrandMetadata, createBrandDirect, checkBrandHandleExists, type PrepareMetadataPayload } from "@/lib/actions/brand-actions"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"

const normalizeHandle = (value: string) => value.replace(/^[@/]+/, "").trim()

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
            </div>

            <div className="mt-6 space-y-6">
                <BasicInfoSection
                    formData={formData}
                    onChange={handleInputChange}
                    categories={categories}
                    disabled={status !== "idle"}
                />
                <WalletSection
                    formData={formData}
                    onChange={handleInputChange}
                    disabled={status !== "idle"}
                />
                <FarcasterSection
                    formData={formData}
                    onChange={handleInputChange}
                    disabled={status !== "idle"}
                    onAutoFill={handleFetchData}
                    isAutoFilling={isFetching}
                />
                <WebMediaSection
                    formData={formData}
                    onChange={handleInputChange}
                    disabled={status !== "idle"}
                />
                <TokenInfoSection
                    formData={formData}
                    onChange={handleInputChange}
                    disabled={status !== "idle"}
                />
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

            <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                        <span>Flow</span>
                        <span>{status === "idle" ? "Ready" : status}</span>
                    </div>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                            className="h-full rounded-full bg-emerald-400 transition-all"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono text-zinc-400 sm:grid-cols-4">
                        {statusSteps.map((step, index) => (
                            <div
                                key={step.key}
                                className={`rounded-md border px-2 py-1 text-center ${
                                    index <= activeStepIndex
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                                        : "border-zinc-800 bg-black/40 text-zinc-500"
                                }`}
                            >
                                {step.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-500">
                        Status: {status === "idle" ? "Ready" : status}
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit || status !== "idle" || !isActive}
                        className="bg-white text-black font-bold uppercase tracking-wide hover:bg-zinc-100"
                    >
                        {status === "idle" ? "Create Onchain" : "Processing..."}
                    </Button>
                </div>
            </div>
        </div>
    )
}
