"use client"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { applyBrand } from "@/lib/actions/brand-actions"
import { useFormStatus } from "react-dom"

type Category = {
    id: number
    name: string
}

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-white text-black px-6 py-3 text-sm font-black font-display uppercase tracking-wide transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
            {pending ? "Submitting..." : "Submit Application"}
        </button>
    )
}

export function ApplyForm({ categories }: { categories: Category[] }) {
    const [queryType, setQueryType] = useState<string>("0")
    const [isFetching, setIsFetching] = useState(false)

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        imageUrl: "",
        url: "",
        warpcastUrl: "",
        followerCount: "",
        channel: "",
        profile: "",
        walletAddress: ""
    })

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
        <form action={applyBrand} className="space-y-6">
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
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="e.g. Farcaster"
                        />
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
                            defaultValue=""
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="" disabled>Select a category</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
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
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
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
                    {/* Channel (if queryType is 0) */}
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

                    {/* Profile (if queryType is 1) */}
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

                    {/* Warpcast URL */}
                    <div className="col-span-2">
                        <label htmlFor="warpcastUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Warpcast URL
                        </label>
                        <input
                            type="url"
                            name="warpcastUrl"
                            id="warpcastUrl"
                            value={formData.warpcastUrl}
                            onChange={handleInputChange}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="https://warpcast.com/~/channel/farcaster"
                        />
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
                        <input
                            type="url"
                            name="url"
                            id="url"
                            value={formData.url}
                            onChange={handleInputChange}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="https://www.farcaster.xyz"
                        />
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
                        <input
                            type="text"
                            name="walletAddress"
                            id="walletAddress"
                            value={formData.walletAddress}
                            onChange={handleInputChange}
                            pattern="^0x[a-fA-F0-9]{40}$"
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors font-mono"
                            placeholder="0x..."
                        />
                        <p className="mt-2 text-xs text-zinc-600">Must be a valid Ethereum address (0x...)</p>
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
