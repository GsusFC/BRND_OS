"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, UploadCloud, X } from "lucide-react"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { BRND_CONTRACT_ABI, BRND_CONTRACT_ADDRESS } from "@/config/brnd-contract"
import {
    getOnchainUpdateBrandFromDb,
    prepareBrandMetadata,
    syncUpdatedOnchainBrandInDb,
    type PrepareMetadataPayload,
    type SyncUpdatedOnchainBrandInDbCode,
} from "@/lib/actions/brand-actions"
import { BrandFormTabs } from "@/components/brands/forms"
import { EMPTY_BRAND_FORM, type CategoryOption, type BrandFormData } from "@/types/brand"
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
import ConnectButton from "@/components/web3/ConnectButton"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"
import { LogoUploader, OnchainProgress, type OnchainStatus } from "@/components/dashboard/applications/shared"
import { OnchainFetchModule } from "@/components/dashboard/onchain-fetch/OnchainFetchModule"
import { useOnchainFetch } from "@/components/dashboard/onchain-fetch/useOnchainFetch"

type IndexerBrandResult = {
    id: number
    fid: number
    handle: string
    walletAddress: string
    metadataHash: string
    createdAt: string
    queryType?: string | number | null
    name?: string | null
    url?: string | null
    warpcastUrl?: string | null
    description?: string | null
    categoryId?: number | string | null
    followerCount?: number | string | null
    imageUrl?: string | null
    profile?: string | null
    channel?: string | null
    tokenContractAddress?: string | null
    tokenTicker?: string | null
    tickerTokenId?: string | null
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
const WALLET_SIGNATURE_TIMEOUT_MS = 90_000
const RECEIPT_TIMEOUT_MS = 120_000
const getCacheKey = (queryValue: string, pageValue: number, limitValue: number) =>
    `${queryValue || ""}|${pageValue}|${limitValue}`
const CARD_META_STORAGE_KEY = "brnd-onchain-card-meta"
const METADATA_HASH_STORAGE_KEY = "brnd-onchain-metadata-hash"

type OnchainEventName =
    | "update_onchain_start"
    | "update_onchain_signing_timeout"
    | "update_onchain_tx_sent"
    | "update_onchain_receipt_timeout"
    | "update_onchain_db_sync_failed"
    | "update_onchain_success"

type OnchainEventPayload = {
    brandId: number
    fid: number
    connectedAddress: string
    chainId: number | undefined
    rpcUsed: string | null
    txHash: string | null
    elapsedMs: number
    code?: string
    reason?: string
}

const logOnchainEvent = (event: OnchainEventName, payload: OnchainEventPayload) => {
    console.info("[onchain-observability]", {
        event,
        ...payload,
    })
}

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
                    {String(suggestedValue || '-')}
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
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}

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
    const [status, setStatus] = useState<OnchainStatus>("idle")
    const detailRef = useRef<HTMLDivElement | null>(null)
    const selectionRequestIdRef = useRef(0)
    const activeSelectionRef = useRef<{ brandId: number; requestId: number } | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [isReviewing, setIsReviewing] = useState(false)
    const [originalFormData, setOriginalFormData] = useState<BrandFormValues | null>(null)

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
    const canUpdate = isAdmin === true && isConnected
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

    const initialFormData: BrandFormValues = {
        ...EMPTY_BRAND_FORM,
        queryType: "0",
    }

    const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(message)), ms)
                }),
            ])
        } finally {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [])

    const waitForReceiptWithFallback = useCallback(
        async (hash: `0x${string}`) => {
            let lastError: unknown
            let lastRpcUsed: string | null = null
            for (const [index, client] of basePublicClients.entries()) {
                const rpcUsed = rpcUrls[index] ?? null
                lastRpcUsed = rpcUsed
                try {
                    const receipt = await withTimeout(
                        client.waitForTransactionReceipt({ hash }),
                        RECEIPT_TIMEOUT_MS,
                        "Timed out while waiting for onchain confirmation."
                    )
                    return {
                        receipt,
                        rpcUsed,
                    }
                } catch (error) {
                    lastError = error
                }
            }
            const error =
                lastError instanceof Error
                    ? lastError
                    : new Error("Could not confirm the transaction on available RPC endpoints.")
            ;(error as Error & { rpcUsed?: string | null }).rpcUsed = lastRpcUsed
            throw error
        },
        [basePublicClients, rpcUrls, withTimeout]
    )
    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandFormSchema),
        defaultValues: initialFormData,
    })
    const formData = form.watch()
    const queryType = toQueryType(formData.queryType)
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

    const categoryMapByName = useMemo(() => {
        const map = new Map<string, string>()
        for (const category of editorCategories) {
            map.set(category.name.trim().toLowerCase(), String(category.id))
        }
        return map
    }, [editorCategories])

    const queryTypeValue = Number(formData.queryType) === 1 ? 1 : 0
    const channelOrProfile = queryTypeValue === 0 ? formData.channel : formData.profile

    const canSubmit = useMemo(() => {
        return Boolean(selected && formData.ownerFid && formData.name && address)
    }, [selected, formData.ownerFid, formData.name, address])

    const resetMessages = useCallback(() => {
        setErrorMessage(null)
        setSuccessMessage(null)
        setListError(null)
    }, [])

    const {
        fetchSource,
        setFetchSource,
        sheetQuery,
        setSheetQuery,
        isFetching,
        isSheetSearching,
        suggestions: farcasterSuggestions,
        setSuggestions,
        notice: farcasterNotice,
        setNotice,
        runFetch,
        applySuggestion: applyFarcasterSuggestion,
        ignoreSuggestion: ignoreFarcasterSuggestion,
        acceptAllSuggestions: handleAcceptAllFarcasterSuggestions,
        ignoreAllSuggestions: handleIgnoreAllFarcasterSuggestions,
    } = useOnchainFetch({
        queryType: toQueryType(formData.queryType),
        channelOrProfile: channelOrProfile ?? "",
        categoryMapByName,
        getFieldValue: (key) => form.getValues(key),
        setFieldValue: (key, value, options) => setFormValues({ [key]: value }, { dirty: options?.dirty ?? true }),
        resetMessages,
    })

    const getFormChanges = useCallback(() => {
        if (!originalFormData) return [];

        const changes: { field: keyof BrandFormValues; original: string; current: string }[] = [];
        const keys: Array<keyof BrandFormValues> = Object.keys(formData) as Array<keyof BrandFormValues>;

        keys.forEach(key => {
            const originalValue = String(originalFormData[key] || '');
            const currentValue = String(formData[key] || '');

            if (originalValue !== currentValue) {
                changes.push({
                    field: key,
                    original: originalValue,
                    current: currentValue
                });
            }
        });
        return changes;
    }, [originalFormData, formData]);

    const handleSearch = async () => {
        resetMessages()
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
    }, [resetMessages])

    useEffect(() => {
        if (isActive) {
            handleLoadRecent()
        }
    }, [handleLoadRecent, isActive])

    const handlePageChange = async (nextPage: number) => {
        resetMessages()
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

    const isSelectionActive = useCallback((brandId: number, requestId?: number) => {
        const active = activeSelectionRef.current
        if (!active) return false
        if (active.brandId !== brandId) return false
        if (requestId !== undefined && active.requestId !== requestId) return false
        return true
    }, [])

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
        const requestId = ++selectionRequestIdRef.current
        activeSelectionRef.current = { brandId: brand.id, requestId }
        resetMessages()
        setSelected(brand)
        setSuggestions(null)
        setNotice(null)
        setSheetQuery("")

        const fallbackValues: BrandFormValues = {
            ...EMPTY_BRAND_FORM,
            ownerFid: String(brand.fid ?? ""),
            walletAddress: brand.walletAddress ?? "",
            queryType: toQueryType(String(brand.queryType ?? "0")),
            name: brand.name || "",
            url: brand.url || "",
            warpcastUrl: brand.warpcastUrl || "",
            description: brand.description || "",
            categoryId: brand.categoryId ? String(brand.categoryId) : "",
            followerCount: brand.followerCount ? String(brand.followerCount) : "0",
            imageUrl: brand.imageUrl || "",
            profile: brand.profile || "",
            channel: brand.channel || "",
            tokenContractAddress: brand.tokenContractAddress || "",
            tokenTicker: brand.tokenTicker || "",
            tickerTokenId: brand.tickerTokenId || "",
        }

        let dbValues = fallbackValues
        const dbResult = await getOnchainUpdateBrandFromDb(brand.id)
        if (!isSelectionActive(brand.id, requestId)) return
        if (dbResult.success && dbResult.data) {
            dbValues = {
                ...EMPTY_BRAND_FORM,
                ownerFid: dbResult.data.ownerFid ? String(dbResult.data.ownerFid) : fallbackValues.ownerFid,
                ownerWalletFid: dbResult.data.ownerWalletFid ? String(dbResult.data.ownerWalletFid) : "",
                walletAddress: dbResult.data.walletAddress || fallbackValues.walletAddress,
                queryType: toQueryType(String(dbResult.data.queryType)),
                name: dbResult.data.name || fallbackValues.name,
                url: dbResult.data.url || "",
                warpcastUrl: dbResult.data.warpcastUrl || "",
                description: dbResult.data.description || "",
                categoryId: dbResult.data.categoryId ? String(dbResult.data.categoryId) : "",
                followerCount: String(dbResult.data.followerCount ?? 0),
                imageUrl: dbResult.data.imageUrl || "",
                profile: dbResult.data.profile || "",
                channel: dbResult.data.channel || "",
                tokenContractAddress: dbResult.data.tokenContractAddress || "",
                tokenTicker: dbResult.data.tokenTicker || "",
                tickerTokenId: fallbackValues.tickerTokenId || "",
            }
        }

        setFormValues(dbValues, { dirty: false })
        setOriginalFormData(dbValues)
        setIsReviewing(false)
        await loadMetadataFromIpfs(brand.metadataHash, brand.id, dbValues, requestId)
    }

    const loadMetadataFromIpfs = async (
        metadataHash: string,
        brandId: number,
        baseValues?: BrandFormValues,
        requestId?: number
    ) => {
        if (!isSelectionActive(brandId, requestId)) return
        setIsLoadingMetadata(true)
        try {
            let resolvedHash = metadataHash
            if (!resolvedHash) {
                const onchain = await fetchOnchainBrand(brandId)
                if (!isSelectionActive(brandId, requestId)) return
                if (onchain?.metadataHash) {
                    resolvedHash = onchain.metadataHash
                    setSelected((prev) => (prev && prev.id === brandId ? { ...prev, metadataHash: resolvedHash } : prev))
                    const sourceValues = baseValues ?? form.getValues()
                    setFormValues(
                        {
                            ownerFid: onchain.fid ? String(onchain.fid) : sourceValues.ownerFid,
                            walletAddress: onchain.walletAddress || sourceValues.walletAddress,
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
                    if (!isSelectionActive(brandId, requestId)) return
                    if (!response.ok) {
                        lastError = `Failed to fetch metadata from ${gateway}`
                        continue
                    }
                    const data = await response.json()
                    const sourceValues = baseValues ?? form.getValues()
                    const fallbackTokenContractAddress = (sourceValues.tokenContractAddress ?? "").trim()
                    const fallbackTokenTicker = normalizeTokenTickerInput(sourceValues.tokenTicker ?? "")
                    const fallbackTickerTokenId = (sourceValues.tickerTokenId ?? "").trim()
                    const ipfsTokenContractAddress =
                        typeof data.tokenContractAddress === "string"
                            ? data.tokenContractAddress.trim()
                            : typeof data.contractAddress === "string"
                                ? data.contractAddress.trim()
                                : ""
                    const ipfsTokenTicker = normalizeTokenTickerInput(
                        typeof data.tokenTicker === "string"
                            ? data.tokenTicker
                            : typeof data.ticker === "string"
                                ? data.ticker
                                : ""
                    )
                    const ipfsTickerTokenId =
                        typeof data.tickerTokenId === "string" ? data.tickerTokenId.trim() : ""
                    setFormValues(
                        {
                            name: data.name || sourceValues.name,
                            url: data.url || "",
                            warpcastUrl: data.warpcastUrl || "",
                            description: data.description || "",
                            categoryId: data.categoryId ? String(data.categoryId) : "",
                            followerCount:
                                data.followerCount !== undefined && data.followerCount !== null
                                    ? String(data.followerCount)
                                    : sourceValues.followerCount,
                            imageUrl: data.imageUrl || "",
                            profile: data.profile || "",
                            channel: data.channel || "",
                            tokenContractAddress: ipfsTokenContractAddress || fallbackTokenContractAddress || "",
                            tokenTicker: ipfsTokenTicker || fallbackTokenTicker || "",
                            tickerTokenId: ipfsTickerTokenId || fallbackTickerTokenId || "",
                            queryType:
                                data.queryType !== undefined && data.queryType !== null
                                    ? toQueryType(String(data.queryType))
                                    : toQueryType(sourceValues.queryType),
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
            if (!isSelectionActive(brandId, requestId)) return
            setErrorMessage(lastError || "Failed to fetch metadata from IPFS.")
        } finally {
            if (isSelectionActive(brandId, requestId)) {
                setIsLoadingMetadata(false)
            }
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
    }, [selected])

    const handleFetchData = useCallback(async () => {
        try {
            await runFetch()
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to fetch data.")
        }
    }, [runFetch])

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
        const selectedSnapshot = selected
        const formSnapshot = form.getValues()

        if (!selectedSnapshot) {
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

        if (!selectedSnapshot.handle) {
            setErrorMessage("Missing handle for onchain update.")
            return
        }
        const fid = Number(formSnapshot.ownerFid)
        if (!Number.isFinite(fid) || fid <= 0) {
            setErrorMessage("FID is required for onchain update.")
            return
        }
        if (!address) {
            setErrorMessage("Connect your admin wallet to update onchain.")
            return
        }

        const normalizedTokenContractAddress = normalizeTokenContractAddressInput(formSnapshot.tokenContractAddress)
        const normalizedTokenTicker = normalizeTokenTickerInput(formSnapshot.tokenTicker)
        const normalizedTickerTokenId = formSnapshot.tickerTokenId?.trim() || ""

        if (!isValidTokenContractAddress(normalizedTokenContractAddress)) {
            setErrorMessage(TOKEN_CONTRACT_ADDRESS_VALIDATION_MESSAGE)
            return
        }

        if (normalizedTokenTicker && !TOKEN_TICKER_REGEX.test(normalizedTokenTicker)) {
            setErrorMessage(TOKEN_TICKER_VALIDATION_MESSAGE)
            return
        }

        const payload: PrepareMetadataPayload = {
            name: formSnapshot.name.trim(),
            handle: selectedSnapshot.handle,
            fid,
            walletAddress: address.trim(),
            url: formSnapshot.url ? formSnapshot.url.trim() : "",
            warpcastUrl: formSnapshot.warpcastUrl ? formSnapshot.warpcastUrl.trim() : "",
            description: formSnapshot.description ? formSnapshot.description.trim() : "",
            categoryId: formSnapshot.categoryId ? Number(formSnapshot.categoryId) : null,
            followerCount: formSnapshot.followerCount ? Number(formSnapshot.followerCount) : 0,
            imageUrl: formSnapshot.imageUrl ? formSnapshot.imageUrl.trim() : "",
            profile: formSnapshot.profile ? formSnapshot.profile.trim() : "",
            channel: formSnapshot.channel ? formSnapshot.channel.trim() : "",
            queryType: queryTypeValue,
            channelOrProfile: channelOrProfile ? channelOrProfile.trim() : "",
            isEditing: true,
            brandId: selectedSnapshot.id,
            tokenContractAddress: normalizedTokenContractAddress || null,
            tokenTicker: normalizedTokenTicker || null,
            contractAddress: normalizedTokenContractAddress || null,
            ticker: normalizedTokenTicker || null,
            tickerTokenId: normalizedTickerTokenId || null,
        }

        const startedAt = Date.now()
        const connectedAddress = address.trim()
        let txHash: `0x${string}` | null = null
        let rpcUsedForReceipt: string | null = null
        const emitEvent = (
            event: OnchainEventName,
            extra?: Partial<Pick<OnchainEventPayload, "rpcUsed" | "txHash" | "code" | "reason">>
        ) => {
            logOnchainEvent(event, {
                brandId: selectedSnapshot.id,
                fid,
                connectedAddress,
                chainId,
                rpcUsed: extra?.rpcUsed ?? rpcUsedForReceipt,
                txHash: extra?.txHash ?? txHash,
                elapsedMs: Date.now() - startedAt,
                code: extra?.code,
                reason: extra?.reason,
            })
        }

        try {
            emitEvent("update_onchain_start", { rpcUsed: null, txHash: null })
            setStatus("validating")
            const prepareResult = await prepareBrandMetadata(payload)
            if (!prepareResult.valid || !prepareResult.metadataHash) {
                setErrorMessage(prepareResult.message || "Failed to prepare brand metadata.")
                setStatus("idle")
                return
            }

            setStatus("ipfs")
            setStatus("signing")
            txHash = await withTimeout(
                writeContractAsync({
                address: BRND_CONTRACT_ADDRESS,
                abi: BRND_CONTRACT_ABI,
                functionName: "updateBrand",
                args: [
                    selectedSnapshot.id,
                    prepareResult.metadataHash,
                    BigInt(fid),
                    address.trim() as `0x${string}`,
                ],
                }),
                WALLET_SIGNATURE_TIMEOUT_MS,
                "Wallet signature timed out. Use an injected wallet (MetaMask/Coinbase extension), keep the wallet window open, and retry."
            )
            emitEvent("update_onchain_tx_sent", { txHash })

            setStatus("confirming")
            const receiptResult = await waitForReceiptWithFallback(txHash)
            rpcUsedForReceipt = receiptResult.rpcUsed

            const dbSyncResult = await syncUpdatedOnchainBrandInDb({
                brandId: selectedSnapshot.id,
                handle: selectedSnapshot.handle,
                name: formSnapshot.name.trim(),
                url: formSnapshot.url ? formSnapshot.url.trim() : "",
                warpcastUrl: formSnapshot.warpcastUrl ? formSnapshot.warpcastUrl.trim() : "",
                description: formSnapshot.description ? formSnapshot.description.trim() : "",
                categoryId: formSnapshot.categoryId ? Number(formSnapshot.categoryId) : null,
                followerCount: formSnapshot.followerCount ? Number(formSnapshot.followerCount) : 0,
                imageUrl: formSnapshot.imageUrl ? formSnapshot.imageUrl.trim() : "",
                profile: formSnapshot.profile ? formSnapshot.profile.trim() : "",
                channel: formSnapshot.channel ? formSnapshot.channel.trim() : "",
                queryType: queryTypeValue,
                ownerFid: fid,
                ownerWalletFid: formSnapshot.ownerWalletFid ? Number(formSnapshot.ownerWalletFid) : null,
                walletAddress: address.trim(),
                tokenContractAddress: normalizedTokenContractAddress || null,
                tokenTicker: normalizedTokenTicker || null,
            })

            if (!dbSyncResult.success) {
                const dbCode = dbSyncResult.code ?? "UNKNOWN"
                emitEvent("update_onchain_db_sync_failed", { code: dbCode, reason: dbSyncResult.message })
                const syncMessageByCode: Record<SyncUpdatedOnchainBrandInDbCode | "UNKNOWN", string> = {
                    DB_CONN: "Onchain updated, but DB sync failed due to a DB connection issue.",
                    VALIDATION: "Onchain updated, but DB sync failed because payload validation did not pass.",
                    NOT_FOUND: "Onchain updated, but DB sync failed because the brand was not found in DB.",
                    UNKNOWN: "Onchain updated, but DB sync failed due to an unknown DB error.",
                }
                const guidanceByCode: Record<SyncUpdatedOnchainBrandInDbCode | "UNKNOWN", string> = {
                    DB_CONN: " Refresh and retry sync once backend DB connectivity is stable.",
                    VALIDATION: " Review mapped fields and retry the sync.",
                    NOT_FOUND: " Verify DB mapping for this onchain brand id and retry.",
                    UNKNOWN: " Retry sync and check backend logs for details.",
                }
                const guidance = guidanceByCode[dbCode]
                setErrorMessage(`${syncMessageByCode[dbCode]} ${dbSyncResult.message || "Unknown DB error."}${guidance}`)
                return
            }

            setSuccessMessage("Brand updated onchain.")
            emitEvent("update_onchain_success")
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : ""
            const isSigningTimeout = errorMessage.includes("Wallet signature timed out")
            const isReceiptTimeout =
                errorMessage.includes("Timed out while waiting for onchain confirmation") ||
                errorMessage.includes("Could not confirm the transaction on available RPC endpoints")

            if (isSigningTimeout) {
                emitEvent("update_onchain_signing_timeout", { reason: errorMessage, txHash: txHash ?? null })
                setErrorMessage(
                    "Wallet signature timed out. Use an injected wallet (MetaMask/Coinbase extension), keep it focused, and retry."
                )
            } else if (isReceiptTimeout) {
                const fallbackRpc =
                    (error as Error & { rpcUsed?: string | null }).rpcUsed ??
                    rpcUsedForReceipt ??
                    null
                emitEvent("update_onchain_receipt_timeout", {
                    reason: errorMessage,
                    rpcUsed: fallbackRpc,
                    txHash: txHash ?? null,
                })
                setErrorMessage(
                    txHash
                        ? `Transaction ${txHash} was sent but confirmation timed out (RPC/network congestion). It may still confirm onchain; verify the hash in a block explorer and then refresh.`
                        : "Transaction confirmation timed out (RPC/network congestion). Retry in a few moments."
                )
            } else {
                const message = isUserRejectedSignature(error)
                    ? "You canceled the signature in your wallet."
                    : error instanceof Error
                        ? error.message
                        : "Failed to update brand onchain."
                setErrorMessage(message)
            }
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

    const formChanges = getFormChanges()
    const changeByField = useMemo(() => {
        const map = new Map<keyof BrandFormValues, { original: string; current: string }>()
        formChanges.forEach((change) => map.set(change.field, { original: change.original, current: change.current }))
        return map
    }, [formChanges])
    const renderChangedBadge = useCallback(
        (field: keyof BrandFormValues) => {
            if (!isReviewing) return null
            if (!changeByField.has(field)) return null
            return (
                <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-950/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-amber-200/80">
                    Changed
                </span>
            )
        },
        [isReviewing, changeByField]
    )

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
                            />
                        </div>
                        <div className="flex items-center">
                            <Button
                                type="button"
                                onClick={handleSearch}
                                disabled={isSearching}
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
                                disabled={isSearching || page <= 1}
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
                                disabled={isSearching || page >= totalPages}
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
                                        className={cn(
                                            "relative rounded-xl border p-3 text-left transition-colors",
                                            selected?.id === brand.id
                                                ? "border-white/30 bg-zinc-900/60"
                                                : "border-zinc-800 bg-black/30 hover:border-zinc-700 hover:bg-zinc-900/30"
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
                                            onClick={() => {
                                                activeSelectionRef.current = null
                                                setSelected(null)
                                            }}
                                            aria-label="Close"
                                            title="Close"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {(formChanges.length > 0 || isReviewing) && (
                                        <div
                                            className={cn(
                                                "mt-4 rounded-xl border px-3 py-2",
                                                isReviewing ? "border-amber-500/40 bg-amber-950/20" : "border-zinc-800 bg-black/30"
                                            )}
                                        >
                                            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                                                <span>
                                                    {formChanges.length} change{formChanges.length === 1 ? "" : "s"}
                                                </span>
                                                <span className={cn(isReviewing ? "text-amber-200" : "text-zinc-500")}>
                                                    {isReviewing ? "Review mode on" : "Review mode off"}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <BrandFormTabs value={activeTab} onValueChange={setActiveTab} showSheetTab={false}>

                                        <TabsContent value="farcaster" className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">Handle</label>
                                                    <Input value={selected.handle} disabled className="mt-2" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        {queryTypeValue === 1 ? "Brand FID (Profile)" : "Owner FID (Channel)"}
                                                        {renderChangedBadge("ownerFid")}
                                                    </label>
                                                    <Input
                                                        name="ownerFid"
                                                        value={formData.ownerFid}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.ownerFid && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.ownerFid}
                                                            onAccept={() => applyFarcasterSuggestion("ownerFid")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("ownerFid")}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Query Type
                                                        {renderChangedBadge("queryType")}
                                                    </label>
                                                    <Select
                                                        value={formData.queryType}
                                                        onValueChange={(value) => setFormValues({ queryType: toQueryType(value) })}
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
                                                    {farcasterSuggestions?.queryType && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.queryType === "1" ? "Profile" : "Channel"}
                                                            onAccept={() => applyFarcasterSuggestion("queryType")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("queryType")}
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-mono text-zinc-500 mb-2">
                                                        {queryTypeValue === 0 ? "Channel" : "Profile"}
                                                        {renderChangedBadge((queryTypeValue === 0 ? "channel" : "profile") as keyof BrandFormValues)}
                                                    </label>
                                                    <Input
                                                        name={queryTypeValue === 0 ? "channel" : "profile"}
                                                        value={queryTypeValue === 0 ? formData.channel : formData.profile}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="w-full"
                                                    />
                                                    {queryTypeValue === 0 && farcasterSuggestions?.channel && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.channel}
                                                            onAccept={() => applyFarcasterSuggestion("channel")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("channel")}
                                                        />
                                                    )}
                                                    {queryTypeValue === 1 && farcasterSuggestions?.profile && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.profile}
                                                            onAccept={() => applyFarcasterSuggestion("profile")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("profile")}
                                                        />
                                                    )}
                                                </div>

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
                                                    hasSuggestions={Boolean(
                                                        farcasterSuggestions && Object.keys(farcasterSuggestions).length > 0,
                                                    )}
                                                    notice={farcasterNotice}
                                                    onAcceptAll={handleAcceptAllFarcasterSuggestions}
                                                    onIgnoreAll={handleIgnoreAllFarcasterSuggestions}
                                                />

                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Warpcast URL
                                                        {renderChangedBadge("warpcastUrl")}
                                                    </label>
                                                    <Input
                                                        name="warpcastUrl"
                                                        value={formData.warpcastUrl}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.warpcastUrl && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.warpcastUrl}
                                                            onAccept={() => applyFarcasterSuggestion('warpcastUrl')}
                                                            onIgnore={() => ignoreFarcasterSuggestion('warpcastUrl')}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="basic" className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Brand name
                                                        {renderChangedBadge("name")}
                                                    </label>
                                                    <Input
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.name && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.name}
                                                            onAccept={() => applyFarcasterSuggestion('name')}
                                                            onIgnore={() => ignoreFarcasterSuggestion('name')}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Website
                                                        {renderChangedBadge("url")}
                                                    </label>
                                                    <Input
                                                        name="url"
                                                        value={formData.url}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.url && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.url}
                                                            onAccept={() => applyFarcasterSuggestion('url')}
                                                            onIgnore={() => ignoreFarcasterSuggestion('url')}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Category
                                                        {renderChangedBadge("categoryId")}
                                                    </label>
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
                                                    {farcasterSuggestions?.categoryId && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.categoryId}
                                                            onAccept={() => applyFarcasterSuggestion("categoryId")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("categoryId")}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Follower count
                                                        {renderChangedBadge("followerCount")}
                                                    </label>
                                                    <Input
                                                        name="followerCount"
                                                        value={formData.followerCount}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.followerCount && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.followerCount}
                                                            onAccept={() => applyFarcasterSuggestion('followerCount')}
                                                            onIgnore={() => ignoreFarcasterSuggestion('followerCount')}
                                                        />
                                                    )}
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Description
                                                        {renderChangedBadge("description")}
                                                    </label>
                                                    <Textarea
                                                        name="description"
                                                        value={formData.description}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2 min-h-[120px]"
                                                    />
                                                    {farcasterSuggestions?.description && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.description}
                                                            onAccept={() => applyFarcasterSuggestion('description')}
                                                            onIgnore={() => ignoreFarcasterSuggestion('description')}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="media" className="space-y-4">
                                            <div>
                                                <label className="text-xs font-mono text-zinc-500 mb-2 block">
                                                    Brand Logo
                                                    {renderChangedBadge("imageUrl")}
                                                </label>
                                                <LogoUploader
                                                    value={formData.imageUrl ?? ""}
                                                    onChange={(url) => setFormValues({ imageUrl: url })}
                                                    disabled={status !== "idle"}
                                                />
                                                {farcasterSuggestions?.imageUrl && (
                                                    <FarcasterSuggestionField
                                                        suggestedValue={farcasterSuggestions.imageUrl}
                                                        onAccept={() => applyFarcasterSuggestion('imageUrl')}
                                                        onIgnore={() => ignoreFarcasterSuggestion('imageUrl')}
                                                    />
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="wallet" className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Guardian fid
                                                        {renderChangedBadge("ownerWalletFid")}
                                                    </label>
                                                    <Input
                                                        name="ownerWalletFid"
                                                        value={formData.ownerWalletFid}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.ownerWalletFid && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.ownerWalletFid}
                                                            onAccept={() => applyFarcasterSuggestion("ownerWalletFid")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("ownerWalletFid")}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="token" className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Token contract address
                                                        {renderChangedBadge("tokenContractAddress")}
                                                    </label>
                                                    <Input
                                                        name="tokenContractAddress"
                                                        value={formData.tokenContractAddress}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.tokenContractAddress && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.tokenContractAddress}
                                                            onAccept={() => applyFarcasterSuggestion("tokenContractAddress")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("tokenContractAddress")}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-mono text-zinc-500">
                                                        Token ticker
                                                        {renderChangedBadge("tokenTicker")}
                                                    </label>
                                                    <Input
                                                        name="tokenTicker"
                                                        value={formData.tokenTicker}
                                                        onChange={handleInputChange}
                                                        disabled={status !== "idle"}
                                                        className="mt-2"
                                                    />
                                                    {farcasterSuggestions?.tokenTicker && (
                                                        <FarcasterSuggestionField
                                                            suggestedValue={farcasterSuggestions.tokenTicker}
                                                            onAccept={() => applyFarcasterSuggestion("tokenTicker")}
                                                            onIgnore={() => ignoreFarcasterSuggestion("tokenTicker")}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </BrandFormTabs>

                                    <div className="mt-5 border-t border-zinc-800 pt-5 flex flex-wrap items-center justify-between gap-4 sticky bottom-0 bg-zinc-900/40 pb-5">
                                        <div className="flex items-center gap-2">
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
                                        </div>
                                        <div className="flex-1 min-w-[300px] flex flex-col gap-2">
                                            <OnchainProgress status={status} />
                                            {errorMessage && (
                                                <span className="text-xs font-mono text-red-400 mt-2">{errorMessage}</span>
                                            )}
                                            {successMessage && (
                                                <span className="text-xs font-mono text-green-400 mt-2">{successMessage}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                type="button"
                                                variant="link"
                                                onClick={() => setIsReviewing((prev) => !prev)}
                                                disabled={formChanges.length === 0}
                                                className="h-auto p-0 text-xs text-zinc-400 hover:text-white"
                                                aria-label="Toggle review mode"
                                                title="Toggle review mode"
                                            >
                                                {isReviewing ? "Exit Review" : "Review Changes"}
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={handleUpdate}
                                                disabled={!canSubmit || status !== "idle" || !canUpdate}
                                                size="default"
                                                className="min-w-[160px] h-9 px-4 text-sm"
                                                aria-label="Update brand onchain"
                                                title="Update brand onchain"
                                            >
                                                {status !== "idle" ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <UploadCloud className="h-5 w-5" />
                                                )}
                                                <span>Update Onchain</span>
                                            </Button>
                                        </div>
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
