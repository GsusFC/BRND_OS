"use client"

import { Category } from "@prisma/client"
import { applyBrand } from "@/lib/actions/brand-actions"
import { useFormStatus } from "react-dom"

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-4 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] font-mono uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.3)]"
        >
            {pending ? "Submitting Application..." : "Submit Application"}
        </button>
    )
}

export function ApplyForm({ categories }: { categories: Category[] }) {
    return (
        <form action={applyBrand} className="space-y-6">
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="col-span-2">
                        <label htmlFor="name" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Brand Name *
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div>
                        <label htmlFor="categoryId" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Category *
                        </label>
                        <select
                            name="categoryId"
                            id="categoryId"
                            required
                            defaultValue=""
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors appearance-none"
                        >
                            <option value="" disabled>Select category</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="walletAddress" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Wallet Address (Optional)
                        </label>
                        <input
                            type="text"
                            name="walletAddress"
                            id="walletAddress"
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="0x..."
                        />
                    </div>

                    <div className="col-span-2">
                        <label htmlFor="description" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Description
                        </label>
                        <textarea
                            name="description"
                            id="description"
                            rows={3}
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="Tell us about your brand..."
                        />
                    </div>

                    <div>
                        <label htmlFor="url" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Website URL
                        </label>
                        <input
                            type="url"
                            name="url"
                            id="url"
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label htmlFor="warpcastUrl" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Warpcast URL
                        </label>
                        <input
                            type="url"
                            name="warpcastUrl"
                            id="warpcastUrl"
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="https://warpcast.com/..."
                        />
                    </div>

                    <div className="col-span-2">
                        <label htmlFor="imageUrl" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-1">
                            Logo URL
                        </label>
                        <input
                            type="url"
                            name="imageUrl"
                            id="imageUrl"
                            className="block w-full rounded-lg border-[0.75px] border-[#484E55] bg-[#110F15] py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono transition-colors"
                            placeholder="https://..."
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <SubmitButton />
                </div>
            </div>
        </form>
    )
}
