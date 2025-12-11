"use client"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { Loader2, Sparkles, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect, useActionState } from "react"
import { createBrand, updateBrand, State } from "@/lib/actions/brand-actions"
import { useFormStatus } from "react-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Category = {
    id: number
    name: string
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="w-full"
        >
            {pending ? "Saving..." : isEditing ? "Update Brand" : "Create Brand"}
        </Button>
    )
}



export function BrandForm({
    categories,
    brand
}: {
    categories: Category[]
    brand?: {
        id?: number
        name?: string
        description?: string
        imageUrl?: string | null
        url?: string
        warpcastUrl?: string
        followerCount?: number
        channel?: string | null
        profile?: string | null
        walletAddress?: string | null
        queryType?: number
        categoryId?: number | null
    }
}) {
    const isEditing = !!brand
    const initialState: State = { message: null, errors: {} }
    const updateBrandWithId = updateBrand.bind(null, brand?.id ?? 0)
    const [state, formAction] = useActionState(isEditing ? updateBrandWithId : createBrand, initialState)
    const router = useRouter()

    const [queryType, setQueryType] = useState<string>(brand?.queryType?.toString() || "0")
    const [isFetching, setIsFetching] = useState(false)

    // Form State for Auto-fill
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_farcasterData, setFarcasterData] = useState<Record<string, unknown> | null>(null)
    const [formData, setFormData] = useState({
        name: brand?.name || "",
        description: brand?.description || "",
        imageUrl: brand?.imageUrl || "",
        url: brand?.url || "",
        warpcastUrl: brand?.warpcastUrl || "",
        followerCount: brand?.followerCount || "",
        channel: brand?.channel || "",
        profile: brand?.profile || "",
        walletAddress: brand?.walletAddress || ""
    })

    useEffect(() => {
        if (state.success) {
            toast.success(state.message)
            router.push("/dashboard/brands")
        } else if (state.message) {
            toast.error(state.message)
        }
    }, [state, router])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleFetchData = async () => {
        const value = queryType === "0" ? formData.channel : formData.profile
        if (!value) return

        setIsFetching(true)
        try {
            const result = await fetchFarcasterData(queryType, value)

            if (result.success && result.data) {
                setFormData(prev => ({
                    ...prev,
                    name: result.data.name || prev.name,
                    description: result.data.description || prev.description,
                    imageUrl: result.data.imageUrl || prev.imageUrl,
                    followerCount: result.data.followerCount || prev.followerCount,
                    warpcastUrl: result.data.warpcastUrl || prev.warpcastUrl,
                    url: result.data.url || prev.url
                }))
                toast.success("Data fetched from Warpcast!")
            } else if (result.error) {
                toast.error(result.error)
            }
        } catch (error) {
            console.error(error)
            toast.error("An unexpected error occurred.")
        } finally {
            setIsFetching(false)
        }
    }

    return (
        <form action={formAction} className="space-y-6 max-w-4xl">
            {/* Header (mantener dentro del formulario para páginas que no lo tengan) */}
            <div className="mb-2">
                <h1 className="text-2xl font-black text-white font-display uppercase">
                    {isEditing ? "Edit Brand" : "New Brand"}
                </h1>
                <p className="text-zinc-500 text-sm">
                    {isEditing ? "Update brand information" : "Register a new brand in the system"}
                </p>
            </div>

            {/* Global Error Message */}
            {state.message && (
                <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-4 flex items-center gap-3 text-red-400 text-sm mb-6">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{state.message}</p>
                </div>
            )}

            {/* Farcaster Information */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Farcaster Details</h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleFetchData}
                        disabled={isFetching || (!formData.channel && !formData.profile)}
                    >
                        {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-400" />}
                        {isFetching ? "Fetching..." : "Auto-Fill"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Channel (if queryType is 0) */}
                    {queryType === "0" && (
                        <div>
                            <label htmlFor="channel" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                                Channel Name
                            </label>
                            <Input
                                type="text"
                                name="channel"
                                id="channel"
                                value={formData.channel}
                                onChange={handleInputChange}
                                placeholder="e.g. farcaster"
                            />
                        </div>
                    )}

                    {/* Profile (if queryType is 1) */}
                    {queryType === "1" && (
                        <div>
                            <label htmlFor="profile" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                                Profile Username
                            </label>
                            <Input
                                type="text"
                                name="profile"
                                id="profile"
                                value={formData.profile}
                                onChange={handleInputChange}
                                placeholder="e.g. dwr"
                            />
                        </div>
                    )}

                    {/* Warpcast URL */}
                    <div className="col-span-2">
                        <label htmlFor="warpcastUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Warpcast URL
                        </label>
                        <Input
                            type="url"
                            name="warpcastUrl"
                            id="warpcastUrl"
                            value={formData.warpcastUrl}
                            onChange={handleInputChange}
                            placeholder="https://warpcast.com/~/channel/farcaster"
                        />
                        {state.errors?.warpcastUrl && (
                            <p id="warpcastUrl-error" className="mt-2 text-xs text-red-400">
                                {state.errors.warpcastUrl[0]}
                            </p>
                        )}
                    </div>

                    {/* Follower Count */}
                    <div>
                        <label htmlFor="followerCount" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Follower Count
                        </label>
                        <Input
                            type="number"
                            name="followerCount"
                            id="followerCount"
                            value={formData.followerCount}
                            onChange={handleInputChange}
                            min="0"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Basic Information</h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Brand Name */}
                    <div className="col-span-2">
                        <label htmlFor="name" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Brand Name *
                        </label>
                        <Input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="e.g. Farcaster"
                            aria-describedby="name-error"
                        />
                        {state.errors?.name && (
                            <p id="name-error" className="mt-2 text-xs text-red-400">
                                {state.errors.name[0]}
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="categoryId" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Category *
                        </label>
                        <select
                            name="categoryId"
                            id="categoryId"
                            defaultValue={brand?.categoryId ?? undefined}
                            required
                            className="block w-full rounded-lg bg-[#212020] border-[0.75px] border-[#484E55] py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                            aria-describedby="category-error"
                        >
                            <option value="" disabled>Select a category</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        {state.errors?.categoryId && (
                            <p id="category-error" className="mt-2 text-xs text-red-400">
                                {state.errors.categoryId[0]}
                            </p>
                        )}
                    </div>

                    {/* Query Type */}
                    <div>
                        <label htmlFor="queryType" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Type *
                        </label>
                        <select
                            name="queryType"
                            id="queryType"
                            value={queryType}
                            onChange={(e) => setQueryType(e.target.value)}
                            required
                            className="block w-full rounded-lg bg-[#212020] border-[0.75px] border-[#484E55] py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="0">Channel</option>
                            <option value="1">Profile</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div className="col-span-2">
                        <label htmlFor="description" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Description
                        </label>
                        <Textarea
                            name="description"
                            id="description"
                            rows={4}
                            value={formData.description}
                            onChange={handleInputChange}
                            className="resize-none"
                            placeholder="Brief description of the brand..."
                        />
                    </div>
                </div>
            </div>

            {/* Web & Media */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Web & Media</h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Website URL */}
                    <div className="col-span-2">
                        <label htmlFor="url" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Website URL
                        </label>
                        <Input
                            type="url"
                            name="url"
                            id="url"
                            value={formData.url}
                            onChange={handleInputChange}
                            placeholder="https://www.farcaster.xyz"
                        />
                        {state.errors?.url && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.url[0]}
                            </p>
                        )}
                    </div>

                    {/* Logo URL & Preview */}
                    <div className="col-span-2">
                        <label htmlFor="imageUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Logo URL
                        </label>
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <Input
                                    type="url"
                                    name="imageUrl"
                                    id="imageUrl"
                                    value={formData.imageUrl}
                                    onChange={handleInputChange}
                                    placeholder="https://..."
                                />
                                {state.errors?.imageUrl && (
                                    <p className="mt-2 text-xs text-red-400">
                                        {state.errors.imageUrl[0]}
                                    </p>
                                )}
                            </div>
                            {/* Image Preview */}
                            <div className="shrink-0">
                                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                                    {formData.imageUrl ? (
                                        <img
                                            src={formData.imageUrl}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-red-900/20');
                                            }}
                                        />
                                    ) : (
                                        <div className="text-zinc-700 text-xs font-mono">IMG</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Blockchain (Optional) */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Blockchain (Optional)</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Wallet Address */}
                    <div>
                        <label htmlFor="walletAddress" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Wallet Address
                        </label>
                        <Input
                            type="text"
                            name="walletAddress"
                            id="walletAddress"
                            value={formData.walletAddress}
                            onChange={handleInputChange}
                            pattern="^0x[a-fA-F0-9]{40}$"
                            className="font-mono"
                            placeholder="0x..."
                        />
                        <p className="mt-2 text-xs text-zinc-600">Must be a valid Ethereum address (0x...)</p>
                        {state.errors?.walletAddress && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.walletAddress[0]}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    )
}
