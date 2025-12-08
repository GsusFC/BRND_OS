'use client'

import { updateTokenGateSettings } from '@/lib/actions/wallet-actions'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
        <Card>
            <CardTitle>Token Gate Settings</CardTitle>
            
            <form action={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="minTokenBalance" className="block text-xs font-mono text-zinc-500 mb-2">
                        Minimum BRND tokens required
                    </label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            name="minTokenBalance"
                            id="minTokenBalance"
                            defaultValue={currentMinBalance}
                            min={0}
                            placeholder="10000000"
                            className="flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex items-center gap-1">
                            {presets.map((preset) => (
                                <Button
                                    key={preset.value}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const input = document.getElementById('minTokenBalance') as HTMLInputElement
                                        if (input) input.value = preset.value
                                    }}
                                    className="text-xs font-mono text-zinc-400 hover:text-white"
                                >
                                    {preset.label.replace(' BRND', '').replace('Disabled ', '')}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    variant="secondary"
                    disabled={isSubmitting}
                    className="w-full"
                >
                    {isSubmitting ? 'Saving...' : 'Update Requirement'}
                </Button>
            </form>

            <p className="mt-4 text-xs text-zinc-600 font-mono">
                Current: {Number(currentMinBalance).toLocaleString()} BRND
                {currentMinBalance === '0' && ' (Token gate disabled)'}
            </p>
        </Card>
    )
}
