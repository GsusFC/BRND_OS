"use client"

import { Loader2, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { BrandFormSectionProps } from "@/types/brand"

export function FarcasterSection({
    formData,
    onChange,
    errors,
    disabled,
    onAutoFill,
    isAutoFilling,
}: BrandFormSectionProps & {
    onAutoFill?: () => void
    isAutoFilling?: boolean
}) {
    const isProfile = formData.queryType === "1"

    return (
        <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
            <div className="border-b border-zinc-900 pb-4 mb-6 flex justify-between items-center">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Farcaster Details</h2>
                {onAutoFill ? (
                    <button
                        type="button"
                        onClick={onAutoFill}
                        disabled={isAutoFilling || (!formData.channel && !formData.profile) || disabled}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAutoFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-400" />}
                        {isAutoFilling ? "Fetching..." : "Auto-Fill"}
                    </button>
                ) : null}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="col-span-2">
                    <label htmlFor="queryType" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Type *
                    </label>
                    <select
                        name="queryType"
                        id="queryType"
                        value={formData.queryType}
                        onChange={onChange}
                        required
                        disabled={disabled}
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors appearance-none cursor-pointer"
                    >
                        <option value="0">Channel</option>
                        <option value="1">Profile</option>
                    </select>
                    {errors?.queryType && (
                        <p className="mt-2 text-xs text-red-400">{errors.queryType[0]}</p>
                    )}
                </div>

                {isProfile ? (
                    <div className="col-span-2">
                        <label htmlFor="profile" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Profile
                        </label>
                        <input
                            type="text"
                            name="profile"
                            id="profile"
                            value={formData.profile}
                            onChange={onChange}
                            disabled={disabled}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="e.g. dwr"
                        />
                        {errors?.profile && (
                            <p className="mt-2 text-xs text-red-400">{errors.profile[0]}</p>
                        )}
                    </div>
                ) : (
                    <div className="col-span-2">
                        <label htmlFor="channel" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            Channel Name
                        </label>
                        <input
                            type="text"
                            name="channel"
                            id="channel"
                            value={formData.channel}
                            onChange={onChange}
                            disabled={disabled}
                            className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                            placeholder="e.g. farcaster"
                        />
                        {errors?.channel && (
                            <p className="mt-2 text-xs text-red-400">{errors.channel[0]}</p>
                        )}
                    </div>
                )}

                <div className="sm:col-span-2">
                    <label htmlFor="warpcastUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Farcaster URL
                    </label>
                    <Input
                        name="warpcastUrl"
                        id="warpcastUrl"
                        value={formData.warpcastUrl}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="https://farcaster.xyz/..."
                    />
                    {errors?.warpcastUrl && (
                        <p className="mt-2 text-xs text-red-400">{errors.warpcastUrl[0]}</p>
                    )}
                </div>

                <div className="sm:col-span-2">
                    <label htmlFor="followerCount" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Follower Count
                    </label>
                    <Input
                        name="followerCount"
                        id="followerCount"
                        type="number"
                        value={formData.followerCount}
                        onChange={onChange}
                        disabled={disabled}
                        min="0"
                        placeholder="0"
                    />
                    {errors?.followerCount && (
                        <p className="mt-2 text-xs text-red-400">{errors.followerCount[0]}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
