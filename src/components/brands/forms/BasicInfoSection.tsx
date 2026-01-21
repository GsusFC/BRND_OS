"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BrandFormSectionProps, CategoryOption } from "@/types/brand"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

export function BasicInfoSection({
    formData,
    onChange,
    errors,
    disabled,
    categories,
}: BrandFormSectionProps & { categories: CategoryOption[] }) {
    const editorCategories = sortCategoriesByCanonicalOrder(
        categories.filter((category) =>
            CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
        )
    )

    return (
        <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
            <div className="border-b border-zinc-900 pb-4 mb-6">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Basic Info</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label htmlFor="name" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Brand Name *
                    </label>
                    <Input
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={onChange}
                        disabled={disabled}
                    />
                    {errors?.name && (
                        <p className="mt-2 text-xs text-red-400">{errors.name[0]}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="categoryId" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Category *
                    </label>
                    <select
                        name="categoryId"
                        id="categoryId"
                        value={formData.categoryId}
                        onChange={onChange}
                        disabled={disabled}
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-3 px-4 text-sm text-white focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    >
                        <option value="" disabled>Select a category</option>
                        {editorCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                    {errors?.categoryId && (
                        <p className="mt-2 text-xs text-red-400">{errors.categoryId[0]}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="ownerFid" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Owner FID *
                    </label>
                    <Input
                        name="ownerFid"
                        id="ownerFid"
                        type="number"
                        value={formData.ownerFid}
                        onChange={onChange}
                        disabled={disabled}
                    />
                    {errors?.ownerFid && (
                        <p className="mt-2 text-xs text-red-400">{errors.ownerFid[0]}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="ownerPrimaryWallet" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Owner Wallet *
                    </label>
                    <Input
                        name="ownerPrimaryWallet"
                        id="ownerPrimaryWallet"
                        value={formData.ownerPrimaryWallet}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="0x..."
                    />
                    {errors?.ownerPrimaryWallet && (
                        <p className="mt-2 text-xs text-red-400">{errors.ownerPrimaryWallet[0]}</p>
                    )}
                </div>

                <div className="sm:col-span-2">
                    <label htmlFor="description" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Description
                    </label>
                    <Textarea
                        name="description"
                        id="description"
                        value={formData.description}
                        onChange={onChange}
                        disabled={disabled}
                        rows={3}
                    />
                    {errors?.description && (
                        <p className="mt-2 text-xs text-red-400">{errors.description[0]}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
