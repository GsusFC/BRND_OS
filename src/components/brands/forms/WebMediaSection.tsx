"use client"

import Image from "next/image"
import { Input } from "@/components/ui/input"
import type { BrandFormSectionProps } from "@/types/brand"

export function WebMediaSection({ formData, onChange, errors, disabled }: BrandFormSectionProps) {
    return (
        <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
            <div className="border-b border-zinc-900 pb-4 mb-6">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Web & Media</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <label htmlFor="url" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Website
                    </label>
                    <Input
                        name="url"
                        id="url"
                        value={formData.url}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="https://..."
                    />
                    {errors?.url && (
                        <p className="mt-2 text-xs text-red-400">{errors.url[0]}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="imageUrl" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Logo URL
                    </label>
                    <Input
                        name="imageUrl"
                        id="imageUrl"
                        value={formData.imageUrl}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="https://..."
                    />
                    {errors?.imageUrl && (
                        <p className="mt-2 text-xs text-red-400">{errors.imageUrl[0]}</p>
                    )}
                </div>

                {formData.imageUrl ? (
                    <div className="sm:col-span-2">
                        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                            <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-800">
                                <Image src={formData.imageUrl} alt="Logo preview" fill className="object-cover" />
                            </div>
                            <div className="text-xs text-zinc-500">
                                Logo preview
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
