"use client"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { Loader2, Sparkles, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState, useActionState } from "react"
import { applyBrand, State } from "@/lib/actions/brand-actions"
import { useFormStatus } from "react-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useTokenGate } from "@/hooks/useTokenGate"
import { useRouter } from "next/navigation"

type Category = {
    id: number
    name: string
}

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="w-full"
        >
            {pending ? "Submitting..." : "Submit Application"}
        </Button>
    )
}

export function ApplyForm({ categories }: { categories: Category[] }) {
    const [queryType, setQueryType] = useState<string>("0")
    const [isFetching, setIsFetching] = useState(false)
    const initialState: State = { message: null, errors: {} }
    const [state, formAction] = useActionState<State, FormData>(applyBrand, initialState)

    const router = useRouter()

    const { address } = useTokenGate()

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        imageUrl: "",
        url: "",
        warpcastUrl: "",
        followerCount: "",
        channel: "",
        profile: "",
        categoryId: "",
        ownerFid: "",
        ownerPrimaryWallet: "",
        walletAddress: ""
    })

    useEffect(() => {
        const nextAddress = address ?? ""
        setFormData((prev) => (prev.walletAddress === nextAddress ? prev : { ...prev, walletAddress: nextAddress }))
    }, [address])

    useEffect(() => {
        if (state.success) {
            if (state.message) {
                toast.success(state.message)
            }
            router.push("/apply/success")
            return
        }

        if (!state.message) return
        toast.error(state.message)
    }, [router, state.message, state.success])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
                    followerCount: result.data.followerCount === undefined || result.data.followerCount === null
                        ? prev.followerCount
                        : String(result.data.followerCount),
                    warpcastUrl: result.data.warpcastUrl || prev.warpcastUrl,
                    url: result.data.url || prev.url
                }))
                toast.success("Data fetched from Farcaster!")
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
        <form action={formAction} className="space-y-6">
            {state.message && !state.success && (
                <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-4 flex items-center gap-3 text-red-400 text-sm mb-6">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{state.message}</p>
                </div>
            )}

            {/* Farcaster Information */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Farcaster Details</h2>
                    <button
                        type="button"
                        onClick={handleFetchData}
                        disabled={isFetching || (!formData.channel && !formData.profile)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-400" />}
                        {isFetching ? "Fetching..." : "Auto-Fill"}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="col-span-2">
                        <label htmlFor="queryType" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Type *
                        </label>
                        <select
                            name="queryType"
                            id="queryType"
                            value={queryType}
                            onChange={(e) => setQueryType(e.target.value)}
                            required
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="0">Channel</option>
                            <option value="1">Profile</option>
                        </select>
                    </div>

                    {queryType === "0" && (
                        <div className="col-span-2">
                            <label htmlFor="channel" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                                Channel Name
                            </label>
                            <input
                                type="text"
                                name="channel"
                                id="channel"
                                value={formData.channel}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                                placeholder="e.g. farcaster"
                            />
                        </div>
                    )}

                    {queryType === "1" && (
                        <div className="col-span-2">
                            <label htmlFor="profile" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                                Profile Username
                            </label>
                            <input
                                type="text"
                                name="profile"
                                id="profile"
                                value={formData.profile}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                                placeholder="e.g. dwr"
                            />
                        </div>
                    )}

                    {/* Farcaster URL */}
                    <div className="col-span-2">
                        <label htmlFor="warpcastUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Farcaster URL
                        </label>
                        <input
                            type="url"
                            name="warpcastUrl"
                            id="warpcastUrl"
                            value={formData.warpcastUrl}
                            onChange={handleInputChange}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="https://..."
                        />
                        {state.errors?.warpcastUrl && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.warpcastUrl[0]}
                            </p>
                        )}
                    </div>

                    {/* Follower Count */}
                    <div>
                        <label htmlFor="followerCount" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Follower Count
                        </label>
                        <input
                            type="number"
                            name="followerCount"
                            id="followerCount"
                            value={formData.followerCount}
                            onChange={handleInputChange}
                            min="0"
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
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
                        />
                        {state.errors?.name && (
                            <p className="mt-2 text-xs text-red-400">
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
                            required
                            value={formData.categoryId}
                            onChange={handleInputChange}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="" disabled>Select a category</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        {state.errors?.categoryId && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.categoryId[0]}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="ownerFid" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Owner FID *
                        </label>
                        <Input
                            type="number"
                            name="ownerFid"
                            id="ownerFid"
                            value={formData.ownerFid}
                            onChange={handleInputChange}
                            min="1"
                            required
                            placeholder="12345"
                        />
                        {state.errors?.ownerFid && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.ownerFid[0]}
                            </p>
                        )}
                    </div>

                    <div className="col-span-2">
                        <label htmlFor="ownerPrimaryWallet" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Owner Primary Wallet *
                        </label>
                        <Input
                            type="text"
                            name="ownerPrimaryWallet"
                            id="ownerPrimaryWallet"
                            value={formData.ownerPrimaryWallet}
                            onChange={handleInputChange}
                            pattern="^0x[a-fA-F0-9]{40}$"
                            required
                            className="font-mono"
                            placeholder="0x..."
                        />
                        {state.errors?.ownerPrimaryWallet && (
                            <p className="mt-2 text-xs text-red-400">
                                {state.errors.ownerPrimaryWallet[0]}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="col-span-2">
                        <label htmlFor="description" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Description
                        </label>
                        <textarea
                            name="description"
                            id="description"
                            rows={4}
                            value={formData.description}
                            onChange={handleInputChange}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors resize-none"
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
                                <input
                                    type="url"
                                    name="imageUrl"
                                    id="imageUrl"
                                    value={formData.imageUrl}
                                    onChange={handleInputChange}
                                    className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
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
                                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center relative">
                                    {formData.imageUrl ? (
                                        <Image
                                            src={formData.imageUrl}
                                            alt="Preview"
                                            width={48}
                                            height={48}
                                            className="object-cover"
                                            onError={(e) => {
                                                console.error("Image load error", e)
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

            {/* Wallet */}
            <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
                <div className="border-b border-zinc-900 pb-4 mb-6">
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Wallet</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Wallet Address */}
                    <div>
                        <label htmlFor="walletAddress" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Wallet Address *
                        </label>
                        <input
                            type="text"
                            name="walletAddress"
                            id="walletAddress"
                            value={formData.walletAddress}
                            pattern="^0x[a-fA-F0-9]{40}$"
                            required
                            readOnly
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors font-mono"
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
                <SubmitButton />
            </div>
        </form>
    )
}
