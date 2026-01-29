"use client"

import { Input } from "@/components/ui/input"
import type { BrandFormSectionProps } from "@/types/brand"

export function WalletSection({
    formData,
    onChange,
    errors,
    disabled,
}: BrandFormSectionProps) {
    return (
        <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
            <div className="border-b border-zinc-900 pb-4 mb-6">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Wallet</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label htmlFor="ownerWalletFid" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Owner Wallet FID
                    </label>
                    <Input
                        name="ownerWalletFid"
                        id="ownerWalletFid"
                        value={formData.ownerWalletFid}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="e.g. 12345"
                    />
                    {errors?.ownerWalletFid && (
                        <p className="mt-2 text-xs text-red-400">{errors.ownerWalletFid[0]}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
