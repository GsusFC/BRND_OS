"use client"

import { Coins, Check, X, Loader2 } from "lucide-react"
import type { BrandFormSectionProps } from "@/types/brand"
import { Input } from "@/components/ui/input"
import { useContractValidation } from "@/hooks/useContractValidation"

export function TokenInfoSection({
    formData,
    onChange,
    errors,
    disabled,
}: BrandFormSectionProps) {
    const { isValid, isLoading } = useContractValidation(formData.tokenContractAddress)

    return (
        <div className="space-y-4 rounded-2xl bg-surface border border-border p-8">
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
                <Coins className="h-4 w-4 text-zinc-400" />
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
                    Token Info
                </h2>
                <span className="text-xs text-zinc-600">(Optional)</span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <label htmlFor="tokenContractAddress" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Contract Address
                    </label>
                    <div className="relative">
                        <Input
                            name="tokenContractAddress"
                            id="tokenContractAddress"
                            value={formData.tokenContractAddress}
                            onChange={onChange}
                            disabled={disabled}
                            placeholder="0x..."
                            className="pr-10 font-mono"
                        />
                        {formData.tokenContractAddress && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                                ) : isValid ? (
                                    <Check className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <X className="h-4 w-4 text-red-400" />
                                )}
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">
                        Smart contract address for the brand token
                    </p>
                    {errors?.tokenContractAddress && (
                        <p className="mt-2 text-xs text-red-400">{errors.tokenContractAddress[0]}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="tokenTicker" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                        Ticker
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                        <Input
                            name="tokenTicker"
                            id="tokenTicker"
                            value={formData.tokenTicker}
                            onChange={(event) => {
                                const uppercased = event.target.value.toUpperCase()
                                const syntheticEvent = {
                                    ...event,
                                    target: {
                                        ...event.target,
                                        name: event.target.name,
                                        value: uppercased,
                                    },
                                }
                                onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
                            }}
                            disabled={disabled}
                            placeholder="BRND"
                            maxLength={10}
                            className="pl-8 font-mono uppercase"
                        />
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">
                        Token ticker symbol (without $ prefix)
                    </p>
                    {errors?.tokenTicker && (
                        <p className="mt-2 text-xs text-red-400">{errors.tokenTicker[0]}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
