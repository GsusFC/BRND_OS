"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, UploadCloud } from "lucide-react"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import { prepareBrandMetadata, type PrepareMetadataPayload } from "@/lib/actions/brand-actions"
import { BrandFormFields } from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from "@/types/brand"
import ConnectButton from "@/components/web3/ConnectButton"

type IndexerBrandResult = {
    id: number
    fid: number
    handle: string
    walletAddress: string
    metadataHash: string
    createdAt: string
}

type CardMetadata = {
    name?: string
    imageUrl?: string
}

const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
]

const normalizeIpfsUrl = (value?: string) => {
    if (!value) return ""
    if (value.startsWith("ipfs://")) {
        const normalized = value.replace("ipfs://", "")
        return `${IPFS_GATEWAYS[0]}${normalized.replace(/^ipfs\//, "")}`
    }
    return value
}

type ListCacheEntry = {
    brands: IndexerBrandResult[]
    page: number
    totalPages: number
    totalCount: number
}

const listCache = new Map<string, ListCacheEntry>()
const cardMetaCache = new Map<number, CardMetadata>()
const metadataHashCache = new Map<number, string>()
const onchainBackoff = new Map<number, number>()
const RATE_LIMIT_COOLDOWN_MS = 30000
const MAX_ONCHAIN_RESOLVE = 6
const getCacheKey = (queryValue: string, pageValue: number, limitValue: number) =>
    `${queryValue || ""}|${pageValue}|${limitValue}`
const CARD_META_STORAGE_KEY = "brnd-onchain-card-meta"
const METADATA_HASH_STORAGE_KEY = "brnd-onchain-metadata-hash"

export function UpdateOnchainPanel({ categories, isActive }: { categories: CategoryOption[]; isActive: boolean }) {
    const [query, setQuery] = useState("")
    const [resultsRaw, setResultsRaw] = useState<IndexerBrandResult[]>([])
    const [selected, setSelected] = useState<IndexerBrandResult | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
    const [lastQuery, setLastQuery] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [listError, setListError] = useState<string | null>(null)
    const [cardMeta, setCardMeta] = useState<Record<number, CardMetadata>>(() => {
        const base = Object.fromEntries(cardMetaCache)
        if (typeof window === "undefined") return base
        try {
            const stored = window.localStorage.getItem(CARD_META_STORAGE_KEY)
            if (!stored) return base
            const parsed = JSON.parse(stored) as Record<string, CardMetadata>
            const normalized = Object.fromEntries(
                Object.entries(parsed).map(([key, value]) => [Number(key), value])
            )
            return { ...base, ...normalized }
        } catch {
            return base
        }
    })
    const [previewStats, setPreviewStats] = useState({ total: 0, loaded: 0, loading: false, error: null as string | null })
    const [hashResolveStats, setHashResolveStats] = useState({ total: 0, resolved: 0, loading: false })
    const [resolvedMetadataHashes, setResolvedMetadataHashes] = useState<Record<number, string>>(() => {
        if (typeof window === "undefined") return {}
        try {
            const stored = window.localStorage.getItem(METADATA_HASH_STORAGE_KEY)
            if (!stored) return {}
            const parsed = JSON.parse(stored) as Record<string, string>
            return Object.fromEntries(
                Object.entries(parsed).map(([key, value]) => [Number(key), value])
            )
        } catch {
            return {}
        }
    })
    const [status, setStatus] = useState<"idle" | "validating" | "ipfs" | "signing" | "confirming">("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const rpcUrls = useMemo(() => {
        const raw = process.env.NEXT_PUBLIC_BASE_RPC_URLS
        if (raw) {
            return raw.split(",").map((entry) => entry.trim()).filter(Boolean)
        }
        return [
            process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
            "https://base.publicnode.com",
            "https://1rpc.io/base",
        ]
    }, [])

    const basePublicClients = useMemo(() => (
        rpcUrls.map((url) => createPublicClient({
            chain: base,
            transport: http(url),
        }))
    ), [rpcUrls])
    const { switchChainAsync } = useSwitchChain()
    const { writeContractAsync } = useWriteContract()
    const { data: isAdmin, isError: isAdminError } = useReadContract({
        address: BRND_CONTRACT_ADDRESS,
        abi: BRND_CONTRACT_ABI,
        functionName: "isAdmin",
        args: address ? [address] : undefined,
        query: { enabled: Boolean(address) },
    })
    const canLoad = isConnected
    const canUpdate = isAdmin === true
    const statusSteps = [
        { key: "validating", label: "Validate" },
        { key: "ipfs", label: "IPFS" },
        { key: "signing", label: "Sign" },
        { key: "confirming", label: "Confirm" },
    ] as const
    const activeStepIndex = status === "idle" ? -1 : statusSteps.findIndex((step) => step.key === status)
    const progressPercent = activeStepIndex < 0 ? 0 : Math.round(((activeStepIndex + 1) / statusSteps.length) * 100)
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
            message.includes("user rejected") ||
            message.includes("request rejected") ||
            message.includes("denied transaction")
        )
    }

    const initialFormData: BrandFormData = {
        ...EMPTY_BRAND_FORM,
        queryType: "0",
    }
    const { formData, setFormData, handleInputChange, queryType } = useBrandForm(initialFormData)

    const queryType = Number(formData.queryType) === 1 ? 1 : 0
    const channelOrProfile = queryType === 0 ? formData.channel : formData.profile

    const canSubmit = useMemo(() => {
        return Boolean(selected && formData.ownerFid && formData.walletAddress && formData.name)
    }, [selected, formData.ownerFid, formData.walletAddress, formData.name])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
        setListError(null)
    }, [])

    const handleSearch = async () => {
        resetMessages()
        if (!canLoad) {
            setListError("Connect your wallet to load onchain brands.")
            return
        }
        setIsSearching(true)
        try {
            const trimmed = query.trim()
            setResultsRaw([])
            if (!trimmed) {
                setLastQuery(null)
                setResultsRaw([])
                setPage(1)
                setTotalPages(1)
                setTotalCount(0)
                setIsSearching(false)
                return
            }
            const cacheKey = getCacheKey(trimmed, 1, 20)
            const cached = listCache.get(cacheKey)
            if (cached) {
                setResultsRaw(cached.brands)
                setPage(cached.page)
                setTotalPages(cached.totalPages)
                setTotalCount(cached.totalCount)
                setLastQuery(trimmed)
                return
            }

            const response = await fetch(`/api/admin/indexer/brands?q=${encodeURIComponent(trimmed)}&page=1&limit=20`)
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || "Failed to search brands.")
            }
            setResultsRaw(data.brands || [])
            setPage(data.page || 1)
            setTotalPages(data.totalPages || 1)
            setTotalCount(data.totalCount || 0)
            setLastQuery(trimmed)
            listCache.set(cacheKey, {
                brands: data.brands || [],
                page: data.page || 1,
                totalPages: data.totalPages || 1,
                totalCount: data.totalCount || 0,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to search brands."
            setListError(message)
        } finally {
            setIsSearching(false)
        }
    }

    const handleLoadRecent = useCallback(async () => {
        resetMessages()
        if (!canLoad) {
            setListError("Connect your wallet to load onchain brands.")
            return
        }
        setIsSearching(true)
        try {
            setLastQuery(null)
            const cacheKey = getCacheKey("", 1, 20)
            const cached = listCache.get(cacheKey)
            if (cached) {
                setResultsRaw(cached.brands)
                setPage(cached.page)
                setTotalPages(cached.totalPages)
                setTotalCount(cached.totalCount)
                return
            }

            const response = await fetch("/api/admin/indexer/brands?page=1&limit=20")
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || "Failed to load recent brands.")
            }
            setResultsRaw(data.brands || [])
            setPage(data.page || 1)
            setTotalPages(data.totalPages || 1)
            setTotalCount(data.totalCount || 0)
            listCache.set(cacheKey, {
                brands: data.brands || [],
                page: data.page || 1,
                totalPages: data.totalPages || 1,
                totalCount: data.totalCount || 0,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load recent brands."
            setListError(message)
        } finally {
            setIsSearching(false)
        }
    }, [canLoad, resetMessages])

    useEffect(() => {
        if (isActive) {
            handleLoadRecent()
        }
    }, [handleLoadRecent, isActive])

    const handlePageChange = async (nextPage: number) => {
        resetMessages()
        if (!canLoad) {
            setListError("Connect your wallet to load onchain brands.")
            return
        }
        setIsSearching(true)
        try {
            const trimmed = query.trim()
            const cacheKey = getCacheKey(trimmed, nextPage, 20)
            const cached = listCache.get(cacheKey)
            if (cached) {
                setResultsRaw(cached.brands)
                setPage(cached.page)
                setTotalPages(cached.totalPages)
                setTotalCount(cached.totalCount)
                return
            }

            const qParam = trimmed ? `q=${encodeURIComponent(trimmed)}&` : ""
            const response = await fetch(`/api/admin/indexer/brands?${qParam}page=${nextPage}&limit=20`)
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || "Failed to load brands.")
            }
            setResultsRaw(data.brands || [])
            setPage(data.page || nextPage)
            setTotalPages(data.totalPages || 1)
            setTotalCount(data.totalCount || 0)
            listCache.set(cacheKey, {
                brands: data.brands || [],
                page: data.page || nextPage,
                totalPages: data.totalPages || 1,
                totalCount: data.totalCount || 0,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load brands."
            setListError(message)
        } finally {
            setIsSearching(false)
        }
    }

    const fetchOnchainBrand = useCallback(async (brandId: number) => {
        const now = Date.now()
        const nextAllowed = onchainBackoff.get(brandId)
        if (nextAllowed && now < nextAllowed) {
            return null
        }
        for (const client of basePublicClients) {
            try {
                const result = await client.readContract({
                    address: BRND_CONTRACT_ADDRESS,
                    abi: BRND_CONTRACT_ABI,
                    functionName: "getBrand",
                    args: [brandId],
                })
                onchainBackoff.delete(brandId)
                return result as {
                    fid: bigint
                    walletAddress: string
                    totalBrndAwarded: bigint
                    availableBrnd: bigint
                    handle: string
                    metadataHash: string
                    createdAt: bigint
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                if (!message.includes("rate limit")) {
                    console.error("Failed to read brand from contract:", error)
                }
                // Try next RPC
            }
        }
        onchainBackoff.set(brandId, Date.now() + RATE_LIMIT_COOLDOWN_MS)
        return null
    }, [basePublicClients])

    const handleSelect = async (brand: IndexerBrandResult) => {
        resetMessages()
        if (!canLoad) {
            setListError("Connect your wallet to load onchain brands.")
            return
        }
        setSelected(brand)
        setFormData((prev) => ({
            ...prev,
            ownerFid: String(brand.fid ?? ""),
            walletAddress: brand.walletAddress ?? "",
        }))
        await loadMetadataFromIpfs(brand.metadataHash, brand.id)
    }

    const loadMetadataFromIpfs = async (metadataHash: string, brandId: number) => {
        let resolvedHash = metadataHash
        if (!resolvedHash) {
            const onchain = await fetchOnchainBrand(brandId)
            if (onchain?.metadataHash) {
                resolvedHash = onchain.metadataHash
                setSelected((prev) => prev ? { ...prev, metadataHash: resolvedHash } : prev)
                setFormData((prev) => ({
                    ...prev,
                    ownerFid: onchain.fid ? String(onchain.fid) : prev.ownerFid,
                    walletAddress: onchain.walletAddress || prev.walletAddress,
                }))
                metadataHashCache.set(brandId, onchain.metadataHash)
                setResolvedMetadataHashes((prev) => ({ ...prev, [brandId]: onchain.metadataHash }))
            }
        }

        if (!resolvedHash) {
            setErrorMessage("Missing metadata hash or RPC rate limited. Try again in a few seconds.")
            return
        }
        setIsLoadingMetadata(true)
        try {
            let lastError: string | null = null
            for (const gateway of IPFS_GATEWAYS) {
                const url = `${gateway}${resolvedHash}`
                try {
                    const response = await fetch(url)
                    if (!response.ok) {
                        lastError = `Failed to fetch metadata from ${gateway}`
                        continue
                    }
                    const data = await response.json()
                    setFormData((prev) => ({
                        ...prev,
                        name: data.name || prev.name,
                        url: data.url || "",
                        warpcastUrl: data.warpcastUrl || "",
                        description: data.description || "",
                        categoryId: data.categoryId ? String(data.categoryId) : "",
                        followerCount: data.followerCount !== undefined && data.followerCount !== null
                            ? String(data.followerCount)
                            : prev.followerCount,
                        imageUrl: data.imageUrl || "",
                        profile: data.profile || "",
                        channel: data.channel || "",
                        queryType: data.queryType !== undefined && data.queryType !== null
                            ? String(data.queryType)
                            : prev.queryType,
                    }))
                    setCardMeta((prev) => {
                        const nextEntry = {
                            name: typeof data.name === "string" ? data.name : prev[brandId]?.name,
                            imageUrl: normalizeIpfsUrl(typeof data.imageUrl === "string" ? data.imageUrl : prev[brandId]?.imageUrl),
                        }
                        cardMetaCache.set(brandId, nextEntry)
                        return {
                            ...prev,
                            [brandId]: nextEntry,
                        }
                    })
                    return
                } catch (error) {
                    lastError = error instanceof Error ? error.message : "Failed to fetch metadata."
                }
            }
            setErrorMessage(lastError || "Failed to fetch metadata from IPFS.")
        } finally {
            setIsLoadingMetadata(false)
        }
    }

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            window.localStorage.setItem(CARD_META_STORAGE_KEY, JSON.stringify(cardMeta))
        } catch {
            // Ignore storage errors (quota, blocked storage)
        }
    }, [cardMeta])

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            window.localStorage.setItem(METADATA_HASH_STORAGE_KEY, JSON.stringify(resolvedMetadataHashes))
        } catch {
            // Ignore storage errors (quota, blocked storage)
        }
    }, [resolvedMetadataHashes])

    const previewBatchInFlight = useRef(false)
    const hashResolveInFlight = useRef(false)

    useEffect(() => {
        let cancelled = false
        const loadCardMetadata = async () => {
            if (!resultsRaw.length) return
            if (previewBatchInFlight.current || hashResolveInFlight.current) return

            const getHashForBrand = (brand: IndexerBrandResult) =>
                brand.metadataHash ||
                resolvedMetadataHashes[brand.id] ||
                metadataHashCache.get(brand.id)

            const missingHashes = resultsRaw.filter((brand) => !getHashForBrand(brand))
            let resolvedMap: Record<number, string> = {}

            if (missingHashes.length > 0) {
                hashResolveInFlight.current = true
                const toResolve = missingHashes.slice(0, MAX_ONCHAIN_RESOLVE)
                setHashResolveStats({ total: toResolve.length, resolved: 0, loading: true })

                const resolveResults: Record<number, string> = {}
                let resolvedCount = 0
                for (const brand of toResolve) {
                    const onchain = await fetchOnchainBrand(brand.id)
                    if (onchain?.metadataHash) {
                        resolveResults[brand.id] = onchain.metadataHash
                        metadataHashCache.set(brand.id, onchain.metadataHash)
                        resolvedCount += 1
                    }
                }

                resolvedMap = resolveResults
                setResolvedMetadataHashes((prev) => ({ ...prev, ...resolveResults }))
                setHashResolveStats({ total: toResolve.length, resolved: resolvedCount, loading: false })
                hashResolveInFlight.current = false
            }

            const mergedHashes = { ...resolvedMetadataHashes, ...resolvedMap }
            const missing = resultsRaw
                .map((brand) => ({
                    id: brand.id,
                    metadataHash: brand.metadataHash || mergedHashes[brand.id] || metadataHashCache.get(brand.id) || "",
                }))
                .filter((entry) => entry.metadataHash && !cardMeta[entry.id])

            if (!missing.length) return

            previewBatchInFlight.current = true
            setPreviewStats({ total: missing.length, loaded: 0, loading: true, error: null })
            try {
                const response = await fetch("/api/admin/indexer/metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: missing.slice(0, 20) }),
                })
                if (!response.ok) {
                    if (!cancelled) {
                        setPreviewStats({ total: missing.length, loaded: 0, loading: false, error: "Failed to load previews." })
                    }
                    return
                }
                const data = await response.json().catch(() => null)
                const results = data?.results
                if (!results || typeof results !== "object") {
                    if (!cancelled) {
                        setPreviewStats({ total: missing.length, loaded: 0, loading: false, error: "No previews returned." })
                    }
                    return
                }

                if (!cancelled) {
                    const loadedCount = Object.keys(results).length
                    setPreviewStats({ total: missing.length, loaded: loadedCount, loading: false, error: null })
                    setCardMeta((prev) => {
                        const next = { ...prev }
                        Object.entries(results).forEach(([key, value]) => {
                            const id = Number(key)
                            if (!Number.isFinite(id)) return
                            const entry = value as { name?: string; imageUrl?: string }
                            const nextEntry = {
                                name: typeof entry.name === "string" ? entry.name : prev[id]?.name,
                                imageUrl: normalizeIpfsUrl(
                                    typeof entry.imageUrl === "string" ? entry.imageUrl : prev[id]?.imageUrl
                                ),
                            }
                            cardMetaCache.set(id, nextEntry)
                            next[id] = nextEntry
                        })
                        return next
                    })
                }
            } finally {
                if (!cancelled) {
                    setPreviewStats((prev) => (prev.loading ? { ...prev, loading: false } : prev))
                }
                previewBatchInFlight.current = false
            }
        }
        loadCardMetadata()
        return () => {
            cancelled = true
        }
    }, [cardMeta, fetchOnchainBrand, resolvedMetadataHashes, resultsRaw])

    const handleUpdate = async () => {
        resetMessages()
        if (!canLoad) {
            setErrorMessage("Connect your admin wallet to continue.")
            return
        }
        if (!selected) {
            setErrorMessage("Select a brand to update.")
            return
        }
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
        if (!canUpdate) {
            setErrorMessage("This wallet is not authorized to update brands onchain.")
            return
        }
        if (chainId !== base.id) {
            await switchChainAsync({ chainId: base.id })
        }

        if (!selected.handle) {
            setErrorMessage("Missing handle for onchain update.")
            return
        }
        const fid = Number(formData.ownerFid)
        if (!Number.isFinite(fid) || fid <= 0) {
            setErrorMessage("FID is required for onchain update.")
            return
        }
        if (!formData.walletAddress) {
            setErrorMessage("Wallet address is required for onchain update.")
            return
        }

        const payload: PrepareMetadataPayload = {
            name: formData.name.trim(),
            handle: selected.handle,
            fid,
            walletAddress: formData.walletAddress.trim(),
            url: formData.url.trim(),
            warpcastUrl: formData.warpcastUrl.trim(),
            description: formData.description.trim(),
            categoryId: formData.categoryId ? Number(formData.categoryId) : null,
            followerCount: formData.followerCount ? Number(formData.followerCount) : 0,
            imageUrl: formData.imageUrl.trim(),
            profile: formData.profile.trim(),
            channel: formData.channel.trim(),
            queryType,
            channelOrProfile: channelOrProfile.trim(),
            isEditing: true,
            brandId: selected.id,
        }

        try {
            setStatus("validating")
            const prepareResult = await prepareBrandMetadata(payload)
            if (!prepareResult.valid || !prepareResult.metadataHash) {
                setErrorMessage(prepareResult.message || "Failed to prepare brand metadata.")
                setStatus("idle")
                return
            }

            setStatus("ipfs")
            setStatus("signing")
            const hash = await writeContractAsync({
                address: BRND_CONTRACT_ADDRESS,
                abi: BRND_CONTRACT_ABI,
                functionName: "updateBrand",
                args: [
                    selected.id,
                    prepareResult.metadataHash,
                    BigInt(fid),
                    formData.walletAddress.trim() as `0x${string}`,
                ],
            })

            setStatus("confirming")
            await basePublicClients[0]?.waitForTransactionReceipt({ hash })

            setSuccessMessage("Brand updated onchain.")
        } catch (error) {
            const message = isUserRejectedSignature(error)
                ? "You canceled the signature in your wallet."
                : error instanceof Error
                    ? error.message
                    : "Failed to update brand onchain."
            setErrorMessage(message)
        } finally {
            setStatus("idle")
        }
    }

    const hasResults = resultsRaw.length > 0
    const selectedIndex = selected ? resultsRaw.findIndex((brand) => brand.id === selected.id) : -1
    const hasPrev = selectedIndex > 0
    const hasNext = selectedIndex >= 0 && selectedIndex < resultsRaw.length - 1

    const handleNavigate = async (direction: "prev" | "next") => {
        if (selectedIndex < 0) return
        const nextIndex = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1
        const nextBrand = resultsRaw[nextIndex]
        if (nextBrand) {
            await handleSelect(nextBrand)
        }
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="flex flex-col gap-4">
                    {!isConnected ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3">
                            <div className="text-xs font-mono text-amber-300">
                                Connect your admin wallet to update brands onchain.
                            </div>
                            <ConnectButton variant="minimal" />
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/40 p-3">
                            <div className="text-xs font-mono text-zinc-400">
                                Wallet connected{address ? ` · ${address.slice(0, 6)}...${address.slice(-4)}` : ""}
                            </div>
                            <div className="text-[10px] font-mono">
                                {isAdminError ? (
                                    <span className="text-red-400">Admin check failed</span>
                                ) : isAdmin === undefined ? (
                                    <span className="text-zinc-500">Checking admin…</span>
                                ) : isAdmin ? (
                                    <span className="text-emerald-400">Admin verified</span>
                                ) : (
                                    <span className="text-amber-400">Not an admin wallet</span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="w-full sm:max-w-md">
                            <Input
                                name="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Handle, brand ID, or FID"
                                className="h-10"
                                disabled={!canLoad}
                            />
                        </div>
                        <div className="flex items-center">
                            <Button
                                type="button"
                                onClick={handleSearch}
                                disabled={isSearching || !canLoad}
                                size="icon-sm"
                                aria-label="Search brands"
                                title="Search brands"
                            >
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                {hasResults && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-500">
                        <span>
                            {totalCount} brands total · page {page} of {totalPages}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            {hashResolveStats.total > 0 && (
                                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/40 px-2.5 py-1 text-[10px] text-zinc-500">
                                    {hashResolveStats.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {hashResolveStats.loading
                                        ? `Resolving metadata ${hashResolveStats.resolved}/${hashResolveStats.total}`
                                        : `Resolved metadata ${hashResolveStats.resolved}/${hashResolveStats.total}`}
                                </span>
                            )}
                            {previewStats.total > 0 && (
                                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/40 px-2.5 py-1 text-[10px] text-zinc-500">
                                    {previewStats.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {previewStats.error
                                        ? previewStats.error
                                        : previewStats.loading
                                            ? `Loading previews ${previewStats.loaded}/${previewStats.total}`
                                            : `Previews ${previewStats.loaded}/${previewStats.total}`}
                                </span>
                            )}
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={isSearching || page <= 1 || !canLoad}
                                aria-label="Previous page"
                                title="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={isSearching || page >= totalPages || !canLoad}
                                aria-label="Next page"
                                title="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
                </div>

                {listError && (
                    <p className="mt-4 text-xs font-mono text-red-400">{listError}</p>
                )}

                {hasResults && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {resultsRaw.map((brand) => {
                            const meta = cardMeta[brand.id]
                            const displayName = meta?.name || brand.handle
                            return (
                            <button
                                key={brand.id}
                                type="button"
                                onClick={() => handleSelect(brand)}
                                disabled={!canLoad}
                                className={cn(
                                    "relative rounded-xl border p-4 text-left transition-colors",
                                    selected?.id === brand.id
                                        ? "border-white/40 bg-zinc-800"
                                        : "border-zinc-800 bg-black hover:border-white/20",
                                    !canLoad && "opacity-60 cursor-not-allowed hover:border-zinc-800"
                                )}
                            >
                                    <div className="flex items-start gap-3">
                                        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-zinc-900">
                                            {meta?.imageUrl ? (
                                                <Image
                                                    src={meta.imageUrl}
                                                    alt={displayName}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-600">
                                                    {displayName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-white truncate">{displayName}</p>
                                            <p className="mt-1 text-xs font-mono text-zinc-500 truncate">
                                                #{brand.id} · {brand.handle}
                                            </p>
                                            <p className="mt-1 text-xs font-mono text-zinc-600">FID {brand.fid}</p>
                                        </div>
                                        {selected?.id === brand.id && (
                                            <span className="text-[10px] font-mono text-white/70">Selected</span>
                                        )}
                                    </div>
                                    {!brand.metadataHash && (
                                        <span className="absolute right-3 top-3 text-[10px] font-mono text-amber-400">
                                            Missing metadata
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}

                {lastQuery && !isSearching && resultsRaw.length === 0 && (
                    <p className="mt-4 text-xs font-mono text-zinc-500">
                        No onchain brands found for “{lastQuery}”.
                    </p>
                )}
            </div>

            <Dialog open={Boolean(selected)} onOpenChange={(open) => {
                if (!open) {
                    setSelected(null)
                }
            }}>
                <DialogContent className="max-w-4xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Update brand #{selected.id} · {selected.handle}</DialogTitle>
                                <div className="mt-2 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon-sm"
                                        onClick={() => handleNavigate("prev")}
                                        disabled={!hasPrev}
                                        aria-label="Previous brand"
                                        title="Previous brand"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon-sm"
                                        onClick={() => handleNavigate("next")}
                                        disabled={!hasNext}
                                        aria-label="Next brand"
                                        title="Next brand"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </DialogHeader>

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-mono text-zinc-500">Loaded from IPFS and onchain data</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => loadMetadataFromIpfs(selected.metadataHash, selected.id)}
                                    disabled={isLoadingMetadata}
                                    aria-label="Reload IPFS"
                                    title="Reload IPFS"
                                >
                                    {isLoadingMetadata ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            <div className="mt-6">
                                <BrandFormFields
                                    formData={formData}
                                    onChange={handleInputChange}
                                    categories={categories}
                                    errors={undefined}
                                    disabled={!selected || status !== "idle"}
                                />
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <Button
                                    type="button"
                                    onClick={handleUpdate}
                                    disabled={!canSubmit || status !== "idle" || !canUpdate}
                                    size="lg"
                                    className="min-w-[220px]"
                                    aria-label="Update onchain"
                                    title="Update onchain"
                                >
                                    {status !== "idle" ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <UploadCloud className="h-5 w-5" />
                                    )}
                                    <span>Update onchain</span>
                                </Button>
                                <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                                        <span>Process</span>
                                        <span className={cn(status === "idle" ? "text-zinc-600" : "text-white/70")}>
                                            {status === "idle" ? "Ready" : statusSteps[activeStepIndex]?.label}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
                                        {statusSteps.map((step, index) => {
                                            const isActive = index === activeStepIndex
                                            const isComplete = activeStepIndex > index
                                            return (
                                                <span
                                                    key={step.key}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded border transition-colors",
                                                        isActive
                                                            ? "border-white/60 bg-white/10 text-white"
                                                            : isComplete
                                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                                : "border-zinc-800 text-zinc-500"
                                                    )}
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
                                {errorMessage && (
                                    <span className="text-xs font-mono text-red-400">{errorMessage}</span>
                                )}
                                {successMessage && (
                                    <span className="text-xs font-mono text-green-400">{successMessage}</span>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
