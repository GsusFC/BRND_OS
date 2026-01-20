"use client"

import { Input } from "@/components/ui/input"
import type { BrandFormSectionProps } from "@/types/brand"

export function WalletSection({
    formData,
    onChange,
    errors,
    disabled,
    readOnly,
}: BrandFormSectionProps & { readOnly?: boolean }) {
    return (
        <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
            <div className="border-b border-zinc-900 pb-4 mb-6">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">Wallet</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label htmlFor="walletAddress" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Wallet Address
                    </label>
                    <Input
                        name="walletAddress"
                        id="walletAddress"
                        value={formData.walletAddress}
                        onChange={onChange}
                        disabled={disabled}
                        readOnly={readOnly}
                        placeholder="0x..."
                        className="font-mono"
                    />
                    <p className="mt-2 text-xs text-zinc-600">Must be a valid Ethereum address (0x...)</p>
                    {errors?.walletAddress && (
                        <p className="mt-2 text-xs text-red-400">{errors.walletAddress[0]}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
