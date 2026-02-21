'use client'
import { ExternalLink, Globe, MessageCircle, Check, Loader2, Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { approveBrandInDb, prepareBrandMetadata, type PrepareMetadataPayload, updateBrand, deleteBrand, type State } from '@/lib/actions/brand-actions'
import { normalizeFarcasterUrl } from '@/lib/farcaster-url'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BrandFormFields } from '@/components/brands/forms'
import { useBrandForm } from '@/hooks/useBrandForm'
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from '@/types/brand'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useAdminUser } from '@/hooks/use-admin-user'
import { base } from 'viem/chains'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from '@/config/brnd-contract'
import { OnchainProgress, type OnchainStatus, ConfirmDialog } from '@/components/dashboard/applications/shared'

interface Application {
    id: number
    name: string
    description: string | null
    url: string | null
    warpcastUrl: string | null
    imageUrl: string | null
    walletAddress?: string | null
    ownerFid: number | null
    ownerPrimaryWallet: string | null
    ownerWalletFid: number | null
    channel: string | null
    profile: string | null
    tokenContractAddress?: string | null
    tokenTicker?: string | null
    queryType: number | null
    followerCount: number | null
    categoryId: number | null
    createdAt: Date
    category: { id: number; name: string } | null
}

interface ApplicationsTableProps {
    applications: Application[]
    categories: CategoryOption[]
}

export function ApplicationsTable({ applications, categories }: ApplicationsTableProps) {
    if (applications.length === 0) {
        return (
            <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-zinc-400 font-mono text-sm">
                    No new applications
                </p>
                <p className="text-zinc-600 font-mono text-xs mt-2">
                    Applications from /apply will appear here
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {applications.map((app) => (
                <ApplicationCard key={app.id} app={app} categories={categories} />
            ))}
        </div>
    )
}

function ApplicationCard({ app, categories }: { app: Application; categories: CategoryOption[] }) {
    const [isEditing, setIsEditing] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const initialState: State = { message: null, errors: {} }
    const updateBrandWithId = updateBrand.bind(null, app.id)
    const [state, formAction] = useActionState<State, FormData>(updateBrandWithId, initialState)
    const [isDeleting, startDelete] = useTransition()
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const router = useRouter()
    const { isAdmin, loading } = useAdminUser()
    const canManage = isAdmin && !loading

    const initialFormData: BrandFormData = {
        ...EMPTY_BRAND_FORM,
        name: app.name || "",
        description: app.description || "",
        imageUrl: app.imageUrl || "",
        url: app.url || "",
        warpcastUrl: app.warpcastUrl || "",
        followerCount: app.followerCount === null || app.followerCount === undefined ? "" : String(app.followerCount),
        channel: app.channel || "",
        profile: app.profile || "",
        categoryId: app.categoryId ? String(app.categoryId) : "",
        ownerFid: app.ownerFid ? String(app.ownerFid) : "",
        ownerPrimaryWallet: app.ownerPrimaryWallet || "",
        ownerWalletFid: app.ownerWalletFid ? String(app.ownerWalletFid) : "",
        walletAddress: app.walletAddress || "",
        queryType: app.queryType?.toString() ?? "0",
        tokenContractAddress: app.tokenContractAddress || "",
        tokenTicker: app.tokenTicker || "",
    }
    const { formData, handleInputChange } = useBrandForm(initialFormData)

    useEffect(() => {
        if (state.success) {
            setIsEditing(false)
        }
    }, [state.success])

    const handleDelete = () => {
        if (!canManage) return
        setDeleteError(null)
        startDelete(async () => {
            const result = await deleteBrand(app.id)
            if (result?.success) {
                setShowDeleteConfirm(false)
                router.refresh()
                return
            }
            setDeleteError(result?.message ?? "Failed to delete brand.")
        })
    }

    const farcasterUrl = normalizeFarcasterUrl(app.warpcastUrl)

    return (
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
            <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    {app.imageUrl ? (
                        <Image
                            src={app.imageUrl}
                            alt={app.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-600">
                            {app.name.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white truncate">
                            {app.name}
                        </h3>
                        {app.category && (
                            <span className="px-2 py-0.5 text-xs font-mono bg-zinc-800 text-zinc-400 rounded">
                                {app.category.name}
                            </span>
                        )}
                    </div>

                    {app.description && (
                        <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                            {app.description}
                        </p>
                    )}

                    {/* Links */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        {app.url && (
                            <a
                                href={app.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                Website
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        {farcasterUrl && (
                            <a
                                href={farcasterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-purple-400 transition-colors"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Farcaster
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>

                    {/* Timestamp */}
                    <p className="mt-2 text-xs text-zinc-600 font-mono">
                        Submitted {new Date(app.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-3 ml-4">
                    <span className="px-3 py-1.5 text-xs font-mono bg-zinc-800 text-zinc-500 rounded-lg">
                        ID: {app.id}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsEditing(true)}
                            disabled={!canManage}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={!canManage || isDeleting}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all",
                                isDeleting || !canManage
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-red-950/40 text-red-300 hover:bg-red-900/60"
                            )}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                        <ApproveButton app={app} disabled={!canManage} />
                    </div>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit pending brand</DialogTitle>
                    </DialogHeader>

                    <form action={formAction} className="space-y-4">
                        <BrandFormFields
                            formData={formData}
                            onChange={handleInputChange}
                            errors={state.errors}
                            categories={categories}
                        />

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title={`Delete ${app.name}?`}
                description={deleteError || "This action cannot be undone. The application will be permanently removed."}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                variant="destructive"
                loading={isDeleting}
            />
        </div>
    )
}

function ApproveButton({ app, disabled }: { app: Application; disabled?: boolean }) {
    const [isPending, startTransition] = useTransition()
    const [done, setDone] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [status, setStatus] = useState<OnchainStatus>("idle")
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const publicClient = usePublicClient({ chainId: base.id })
    const { switchChainAsync } = useSwitchChain()
    const { writeContractAsync } = useWriteContract()
    const { data: isAdmin, isError: isAdminError } = useReadContract({
        address: BRND_CONTRACT_ADDRESS,
        abi: BRND_CONTRACT_ABI,
        functionName: "isAdmin",
        args: address ? [address] : undefined,
        query: { enabled: Boolean(address) },
    })

    const normalizeHandle = (value: string) => value.replace(/^[@/]+/, "").trim()

    const handleApprove = () => {
        if (disabled) return
        startTransition(async () => {
            try {
                setErrorMessage(null)
                setStatus("idle")

                if (!isConnected || !address) {
                    setErrorMessage("Connect your admin wallet to continue.")
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

                setStatus("validating")
                const queryType = app.queryType ?? 0
                const channelOrProfile = queryType === 0 ? (app.channel || "") : (app.profile || "")
                const handleSource = channelOrProfile.trim()
                const handle = normalizeHandle(handleSource).toLowerCase()
                const fid = app.ownerFid ? Number(app.ownerFid) : 0
                const connectedWallet = address.trim()
                const normalizedTokenContractAddress = app.tokenContractAddress?.trim() || null
                const normalizedTokenTicker = app.tokenTicker?.trim() || null

                const payload: PrepareMetadataPayload = {
                    name: app.name || "",
                    handle,
                    fid,
                    walletAddress: connectedWallet,
                    url: app.url || "",
                    warpcastUrl: app.warpcastUrl || "",
                    description: app.description || "",
                    categoryId: app.categoryId ?? null,
                    followerCount: app.followerCount ?? 0,
                    imageUrl: app.imageUrl || "",
                    profile: app.profile || "",
                    channel: app.channel || "",
                    queryType,
                    channelOrProfile,
                    isEditing: false,
                    tokenContractAddress: normalizedTokenContractAddress,
                    tokenTicker: normalizedTokenTicker,
                    contractAddress: normalizedTokenContractAddress,
                    ticker: normalizedTokenTicker,
                }

                setStatus("ipfs")
                const prepareResult = await prepareBrandMetadata(payload)
                if (!prepareResult.valid || !prepareResult.metadataHash) {
                    setErrorMessage(prepareResult.message || "Failed to prepare brand metadata.")
                    setStatus("idle")
                    return
                }

                const metadataHash = prepareResult.metadataHash
                const finalHandle = prepareResult.handle || handle
                const finalFid = prepareResult.fid ?? fid
                const finalWallet = (prepareResult.walletAddress || connectedWallet).trim()

                setStatus("signing")
                const hash = await writeContractAsync({
                    address: BRND_CONTRACT_ADDRESS,
                    abi: BRND_CONTRACT_ABI,
                    functionName: "createBrand",
                    args: [finalHandle, metadataHash, BigInt(finalFid), finalWallet as `0x${string}`],
                })

                if (!publicClient) {
                    setErrorMessage("Missing public client to confirm transaction.")
                    setStatus("idle")
                    return
                }

                setStatus("confirming")
                await publicClient.waitForTransactionReceipt({ hash })

                const dbResult = await approveBrandInDb(app.id)
                if (!dbResult?.success) {
                    setErrorMessage(dbResult?.message || "Brand approved onchain but failed to update database.")
                    setStatus("idle")
                    return
                }

                setDone(true)
                router.refresh()
            } catch (error) {
                console.error('Failed to approve brand:', error)
                setErrorMessage("Failed to approve brand onchain.")
            } finally {
                setStatus("idle")
            }
        })
    }

    if (done) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-950/30 border border-green-900/50 rounded-xl text-green-400 font-mono text-sm">
                <Check className="w-4 h-4" />
                Approved
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <button
                onClick={handleApprove}
                disabled={disabled || isPending}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all",
                    isPending || disabled
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        : "bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                )}
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {status === "validating" && "Validating..."}
                        {status === "ipfs" && "Uploading..."}
                        {status === "signing" && "Signing..."}
                        {status === "confirming" && "Confirming..."}
                        {status === "idle" && "Approving..."}
                    </>
                ) : (
                    "Approve Onchain"
                )}
            </button>
            <OnchainProgress status={status} compact />
            {errorMessage && (
                <span className="text-[10px] text-red-400 font-mono max-w-[220px] text-right">
                    {errorMessage}
                </span>
            )}
        </div>
    )
}
