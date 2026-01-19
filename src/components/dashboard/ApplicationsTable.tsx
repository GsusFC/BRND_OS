'use client'
import { ExternalLink, Globe, MessageCircle, Wallet, Check, Loader2, Pencil } from 'lucide-react'
import Image from 'next/image'
import { approveBrandInDb, prepareBrandMetadata, type PrepareMetadataPayload, updateBrand, deleteBrand, type State } from '@/lib/actions/brand-actions'
import { normalizeFarcasterUrl } from '@/lib/farcaster-url'
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useAdminUser } from '@/hooks/use-admin-user'
import { base } from 'viem/chains'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from '@/config/brnd-contract'

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
    channel: string | null
    profile: string | null
    queryType: number | null
    followerCount: number | null
    categoryId: number | null
    createdAt: Date
    category: { id: number; name: string } | null
}

interface CategoryOption {
    id: number
    name: string
}

interface ApplicationsTableProps {
    applications: Application[]
    categories: CategoryOption[]
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
    const editorCategories = useMemo(
        () => categories.filter((category) => EDITOR_CATEGORIES.includes(category.name as (typeof EDITOR_CATEGORIES)[number])),
        [categories]
    )
    const [isEditing, setIsEditing] = useState(false)
    const [queryType, setQueryType] = useState<string>(app.queryType?.toString() ?? "0")
    const initialState: State = { message: null, errors: {} }
    const updateBrandWithId = updateBrand.bind(null, app.id)
    const [state, formAction] = useActionState<State, FormData>(updateBrandWithId, initialState)
    const [isDeleting, startDelete] = useTransition()
    const router = useRouter()
    const { isAdmin, loading } = useAdminUser()
    const canManage = isAdmin && !loading

    const [formData, setFormData] = useState({
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
        walletAddress: app.walletAddress || "",
    })

    useEffect(() => {
        if (state.success) {
            setIsEditing(false)
        }
    }, [state.success])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
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
                        {app.walletAddress && (
                            <a
                                href={`https://basescan.org/address/${app.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-blue-400 transition-colors"
                            >
                                <Wallet className="w-3.5 h-3.5" />
                                {app.walletAddress.slice(0, 6)}...{app.walletAddress.slice(-4)}
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
                            className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                        <button
                            onClick={() => {
                                if (!canManage) return
                                if (!confirm(`Delete ${app.name}? This cannot be undone.`)) return
                                startDelete(async () => {
                                    const result = await deleteBrand(app.id)
                                    if (result?.success) {
                                        router.refresh()
                                        return
                                    }
                                    alert(result?.message ?? "Failed to delete brand.")
                                })
                            }}
                            disabled={!canManage || isDeleting}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all",
                                isDeleting || !canManage
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-red-950/40 text-red-300 hover:bg-red-900/60"
                            )}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                        <ApproveButton app={app} disabled={!canManage} />
                    </div>
                </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit pending brand</DialogTitle>
                    </DialogHeader>

                    <form action={formAction} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Name *</label>
                                <Input name="name" value={formData.name} onChange={handleInputChange} />
                                {state.errors?.name && <p className="mt-1 text-xs text-red-400">{state.errors.name[0]}</p>}
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
                                {state.errors?.categoryId && <p className="mt-1 text-xs text-red-400">{state.errors.categoryId[0]}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Query Type *</label>
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
                                    <label className="block text-xs font-mono text-zinc-500 mb-2">Channel</label>
                                    <Input name="channel" value={formData.channel} onChange={handleInputChange} placeholder="e.g. farcaster" />
                                </div>
                            ) : (
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-mono text-zinc-500 mb-2">Profile</label>
                                    <Input name="profile" value={formData.profile} onChange={handleInputChange} placeholder="e.g. dwr" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Owner FID *</label>
                                <Input name="ownerFid" type="number" value={formData.ownerFid} onChange={handleInputChange} />
                                {state.errors?.ownerFid && <p className="mt-1 text-xs text-red-400">{state.errors.ownerFid[0]}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Owner Wallet *</label>
                                <Input name="ownerPrimaryWallet" value={formData.ownerPrimaryWallet} onChange={handleInputChange} placeholder="0x..." />
                                {state.errors?.ownerPrimaryWallet && <p className="mt-1 text-xs text-red-400">{state.errors.ownerPrimaryWallet[0]}</p>}
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
                                {state.errors?.url && <p className="mt-1 text-xs text-red-400">{state.errors.url[0]}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Farcaster URL</label>
                                <Input name="warpcastUrl" value={formData.warpcastUrl} onChange={handleInputChange} placeholder="https://farcaster.xyz/..." />
                                {state.errors?.warpcastUrl && <p className="mt-1 text-xs text-red-400">{state.errors.warpcastUrl[0]}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Logo URL</label>
                                <Input name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." />
                                {state.errors?.imageUrl && <p className="mt-1 text-xs text-red-400">{state.errors.imageUrl[0]}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Follower Count</label>
                                <Input name="followerCount" type="number" value={formData.followerCount} onChange={handleInputChange} min="0" />
                                {state.errors?.followerCount && <p className="mt-1 text-xs text-red-400">{state.errors.followerCount[0]}</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-mono text-zinc-500 mb-2">Wallet Address (for gating)</label>
                                <Input name="walletAddress" value={formData.walletAddress} onChange={handleInputChange} placeholder="0x..." />
                                {state.errors?.walletAddress && <p className="mt-1 text-xs text-red-400">{state.errors.walletAddress[0]}</p>}
                            </div>
                        </div>

                        {state.message && !state.success && (
                            <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-3 text-red-400 text-xs font-mono">
                                {state.message}
                            </div>
                        )}

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ApproveButton({ app, disabled }: { app: Application; disabled?: boolean }) {
    const [isPending, startTransition] = useTransition()
    const [done, setDone] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [status, setStatus] = useState<"idle" | "validating" | "ipfs" | "signing" | "confirming">("idle")
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
                const ownerWallet = app.walletAddress || ""

                if (!handle) {
                    setErrorMessage("Missing handle for onchain creation.")
                    setStatus("idle")
                    return
                }
                if (!fid) {
                    setErrorMessage("Missing FID for onchain creation.")
                    setStatus("idle")
                    return
                }
                if (!ownerWallet) {
                    setErrorMessage("Missing wallet address for onchain creation.")
                    setStatus("idle")
                    return
                }

                const payload: PrepareMetadataPayload = {
                    name: app.name || "",
                    handle,
                    fid,
                    walletAddress: ownerWallet,
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
                const finalWallet = prepareResult.walletAddress || ownerWallet

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
            {status !== "idle" && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span className={cn("px-2 py-1 rounded border", status === "validating" ? "border-white/40 text-white" : "border-zinc-800")}>
                        Validate
                    </span>
                    <span className={cn("px-2 py-1 rounded border", status === "ipfs" ? "border-white/40 text-white" : "border-zinc-800")}>
                        IPFS
                    </span>
                    <span className={cn("px-2 py-1 rounded border", status === "signing" ? "border-white/40 text-white" : "border-zinc-800")}>
                        Sign
                    </span>
                    <span className={cn("px-2 py-1 rounded border", status === "confirming" ? "border-white/40 text-white" : "border-zinc-800")}>
                        Confirm
                    </span>
                </div>
            )}
            {errorMessage && (
                <span className="text-[10px] text-red-400 font-mono max-w-[220px] text-right">
                    {errorMessage}
                </span>
            )}
        </div>
    )
}
