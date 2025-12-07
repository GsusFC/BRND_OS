'use client'

import { updateTokenGateSettings } from '@/lib/actions/wallet-actions'
import { useState } from 'react'
import { toast } from 'sonner'

interface TokenSettingsFormProps {
    currentMinBalance: string
}

export function TokenSettingsForm({ currentMinBalance }: TokenSettingsFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true)
        const result = await updateTokenGateSettings(formData)
        setIsSubmitting(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Token requirement updated')
        }
    }

    const presets = [
        { label: 'Disabled (0)', value: '0' },
        { label: '1M BRND', value: '1000000' },
        { label: '5M BRND', value: '5000000' },
        { label: '10M BRND', value: '10000000' },
    ]

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
                Token Gate Settings
            </h3>
            
            <form action={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="minTokenBalance" className="block text-xs font-mono text-zinc-500 mb-2">
                        Minimum BRND tokens required
                    </label>
                    <input
                        type="number"
                        name="minTokenBalance"
                        id="minTokenBalance"
                        defaultValue={currentMinBalance}
                        min="0"
                        className="block w-full rounded-lg bg-black border border-zinc-800 py-2 px-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                        placeholder="10000000"
                    />
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                                const input = document.getElementById('minTokenBalance') as HTMLInputElement
                                if (input) input.value = preset.value
                            }}
                            className="px-3 py-1 text-xs font-mono rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-white text-black px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : 'Update Requirement'}
                </button>
            </form>

            <p className="mt-4 text-xs text-zinc-600 font-mono">
                Current: {Number(currentMinBalance).toLocaleString()} BRND
                {currentMinBalance === '0' && ' (Token gate disabled)'}
            </p>
        </div>
    )
}
