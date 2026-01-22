"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Coins, Image as ImageIcon, Info, Link2, Loader2, MessageSquare, RefreshCw, Search, Upload, UploadCloud, Wallet, X } from "lucide-react"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import { prepareBrandMetadata, type PrepareMetadataPayload } from "@/lib/actions/brand-actions"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from "@/types/brand"
import { brandFormSchema, type BrandFormValues } from "@/lib/validations/brand-form"
import ConnectButton from "@/components/web3/ConnectButton"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

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

type UploadMode = "url" | "file"

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

const normalizeMetadataHash = (value: string) =>
    value.replace("ipfs://", "").replace(/^ipfs\//, "")

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
    const detailRef = useRef<HTMLDivElement | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [isFetching, setIsFetching] = useState(false)
    const [logoMode, setLogoMode] = useState<UploadMode>("url")
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [logoUploadState, setLogoUploadState] = useState<"idle" | "compressing" | "uploading" | "success" | "error">("idle")
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

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
        queryType: "0" as const,
    }
    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandFormSchema),
        defaultValues: initialFormData,
    })
    const formData = form.watch()
    const queryType = formData.queryType ?? "0"
    const setFormValues = useCallback(
        (next: Partial<BrandFormValues>, options?: { dirty?: boolean }) => {
            const shouldDirty = options?.dirty ?? true
            Object.entries(next).forEach(([key, value]) => {
                form.setValue(key as keyof BrandFormValues, value as BrandFormValues[keyof BrandFormValues], {
                    shouldDirty,
                    shouldTouch: shouldDirty,
                })
            })
        },
        [form]
    )
    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = event.target
            form.setValue(name as keyof BrandFormValues, value as BrandFormValues[keyof BrandFormValues], {
                shouldDirty: true,
                shouldTouch: true,
            })
        },
        [form]
    )
    const editorCategories = useMemo(
        () =>
            sortCategoriesByCanonicalOrder(
                categories.filter((category) =>
                    CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
                )
            ),
        [categories]
    )

    const queryTypeValue = Number(formData.queryType) === 1 ? 1 : 0
    const channelOrProfile = queryTypeValue === 0 ? formData.channel : formData.profile

    const canSubmit = useMemo(() => {
        return Boolean(selected && formData.ownerFid && formData.walletAddress && formData.name)
    }, [selected, formData.ownerFid, formData.walletAddress, formData.name])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
        setListError(null)
    }, [])

    const resetLogoState = useCallback(() => {
        setLogoUploadState("idle")
        setLogoUploadError(null)
    }, [])

    const handleLogoModeChange = (mode: UploadMode) => {
        setLogoMode(mode)
        resetLogoState()
        if (mode === "url") {
            setLogoPreview(formData.imageUrl ? normalizeIpfsUrl(formData.imageUrl) : null)
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
            setFormValues({ imageUrl: nextUrl })
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
        setFormValues(
            {
                ownerFid: String(brand.fid ?? ""),
                walletAddress: brand.walletAddress ?? "",
                ownerWalletFid: "",
            },
            { dirty: false }
        )
        await loadMetadataFromIpfs(brand.metadataHash, brand.id)
    }

    const loadMetadataFromIpfs = async (metadataHash: string, brandId: number) => {
        setIsLoadingMetadata(true)
        try {
            let resolvedHash = metadataHash
            if (!resolvedHash) {
                const onchain = await fetchOnchainBrand(brandId)
                if (onchain?.metadataHash) {
                    resolvedHash = onchain.metadataHash
                    setSelected((prev) => prev ? { ...prev, metadataHash: resolvedHash } : prev)
                    setFormValues(
                        {
                            ownerFid: onchain.fid ? String(onchain.fid) : formData.ownerFid,
                            walletAddress: onchain.walletAddress || formData.walletAddress,
                        },
                        { dirty: false }
                    )
                    metadataHashCache.set(brandId, onchain.metadataHash)
                    setResolvedMetadataHashes((prev) => ({ ...prev, [brandId]: onchain.metadataHash }))
                }
            }

            if (!resolvedHash) {
                setErrorMessage("Missing metadata hash or RPC rate limited. Try again in a few seconds.")
                return
            }
            const normalizedHash = normalizeMetadataHash(resolvedHash)
            let lastError: string | null = null
            for (const gateway of IPFS_GATEWAYS) {
                const url = `${gateway}${normalizedHash}`
                try {
                    const response = await fetch(url)
                    if (!response.ok) {
                        lastError = `Failed to fetch metadata from ${gateway}`
                        continue
                    }
                    const data = await response.json()
                    setFormValues(
                        {
                            name: data.name || formData.name,
                            url: data.url || "",
                            warpcastUrl: data.warpcastUrl || "",
                            description: data.description || "",
                            categoryId: data.categoryId ? String(data.categoryId) : "",
                            followerCount:
                                data.followerCount !== undefined && data.followerCount !== null
                                    ? String(data.followerCount)
                                    : formData.followerCount,
                            imageUrl: data.imageUrl || "",
                            profile: data.profile || "",
                            channel: data.channel || "",
                            tokenContractAddress: data.tokenContractAddress || "",
                            tokenTicker: data.tokenTicker || "",
                            queryType:
                                data.queryType !== undefined && data.queryType !== null
                                    ? String(data.queryType)
                                    : formData.queryType,
                        },
                        { dirty: false }
                    )
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

    useEffect(() => {
        if (!selected) return
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, [selected])

    useEffect(() => {
        if (!selected) return
        setActiveTab("farcaster")
        setLogoMode("url")
        setLogoPreview(formData.imageUrl ? normalizeIpfsUrl(formData.imageUrl) : null)
        resetLogoState()
    }, [formData.imageUrl, resetLogoState, selected])

    useEffect(() => {
        if (logoMode !== "url") return
        setLogoPreview(formData.imageUrl ? normalizeIpfsUrl(formData.imageUrl) : null)
    }, [formData.imageUrl, logoMode])

    const handleFetchData = async () => {
        const value = queryType === "0" ? formData.channel : formData.profile
        if (!value) return
        setIsFetching(true)
        resetMessages()
        try {
            const result = await fetchFarcasterData(queryType, value)
            if (result.success && result.data) {
                setFormValues(
                    {
                        name: result.data.name || formData.name,
                        description: result.data.description || formData.description,
                        imageUrl: result.data.imageUrl || formData.imageUrl,
                        followerCount:
                            result.data.followerCount === undefined || result.data.followerCount === null
                                ? formData.followerCount
                                : String(result.data.followerCount),
                        warpcastUrl: result.data.warpcastUrl || formData.warpcastUrl,
                        url: result.data.url || formData.url,
                    },
                    { dirty: true }
                )
            } else if (result.error) {
                setErrorMessage(result.error)
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch Farcaster data.")
        } finally {
            setIsFetching(false)
        }
    }

    useEffect(() => {
        return () => {
            if (logoPreview?.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview)
            }
        }
    }, [logoPreview])

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
            url: formData.url ? formData.url.trim() : "",
            warpcastUrl: formData.warpcastUrl ? formData.warpcastUrl.trim() : "",
            description: formData.description ? formData.description.trim() : "",
            categoryId: formData.categoryId ? Number(formData.categoryId) : null,
            followerCount: formData.followerCount ? Number(formData.followerCount) : 0,
            imageUrl: formData.imageUrl ? formData.imageUrl.trim() : "",
            profile: formData.profile ? formData.profile.trim() : "",
            channel: formData.channel ? formData.channel.trim() : "",
            queryType: queryTypeValue,
            channelOrProfile: channelOrProfile ? channelOrProfile.trim() : "",
            isEditing: true,
            brandId: selected.id,
            tokenContractAddress: formData.tokenContractAddress ? formData.tokenContractAddress.trim() : null,
            tokenTicker: formData.tokenTicker ? formData.tokenTicker.trim() : null,
            contractAddress: formData.tokenContractAddress ? formData.tokenContractAddress.trim() : null,
            ticker: formData.tokenTicker ? formData.tokenTicker.trim() : null,
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
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
                                className="h-9"
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
                                            "relative rounded-xl border p-3 text-left transition-colors",
                                            selected?.id === brand.id
                                                ? "border-white/30 bg-zinc-900/60"
                                                : "border-zinc-800 bg-black/30 hover:border-zinc-700 hover:bg-zinc-900/30",
                                            !canLoad && "opacity-60 cursor-not-allowed hover:border-zinc-800"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-11 w-11 overflow-hidden rounded-lg bg-zinc-900">
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
                                                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                                                <p className="mt-1 text-xs font-mono text-zinc-500 truncate">
                                                    @{brand.handle}
                                                </p>
                                            </div>
                                        </div>
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

                <div className="lg:sticky lg:top-6 lg:self-start">
                    {selected ? (
                        <div ref={detailRef} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-white">Update brand #{selected.id} · {selected.handle}</h2>
                                    <p className="mt-1 text-[11px] font-mono text-zinc-500">Loaded from IPFS and onchain data</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setSelected(null)}
                                    aria-label="Close"
                                    title="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                    <div className="mt-2 flex items-center justify-end" />

                    <div className="mt-5">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                            <TabsList className="w-fit mx-auto">
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
                                        <label className="text-xs font-mono text-zinc-500">Handle</label>
                                        <Input value={selected.handle} disabled className="mt-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-mono text-zinc-500">FID</label>
                                        <Input
                                            name="ownerFid"
                                            value={formData.ownerFid}
                                            onChange={handleInputChange}
                                            disabled={status !== "idle"}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-mono text-zinc-500">Query Type</label>
                                        <Select
                                            value={formData.queryType}
                                            onValueChange={(value) => setFormValues({ queryType: value })}
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
                                                setFormValues({ categoryId: value === "none" ? "" : value })
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
                                    name="walletAddress"
                                    value={formData.walletAddress}
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

                    <div className="mt-5 flex flex-wrap items-center gap-2">
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
                        <Button
                            type="button"
                            onClick={handleUpdate}
                            disabled={!canSubmit || status !== "idle" || !canUpdate}
                            size="default"
                            className="min-w-[150px] h-9 px-4 text-sm"
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
                        <div className="flex min-w-[180px] flex-1 flex-col gap-2">
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
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-black/40 p-6 text-center text-sm text-zinc-500">
                    Select a brand on the left to start the onchain update.
                </div>
            )}
                </div>
            </div>
        </div>
    )
}
