'use client'

import { updateTokenGateSettings } from '@/lib/actions/wallet-actions'
import { useEffect, useState, type FormEventHandler } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface TokenSettingsFormProps {
    currentMinBalance: string
    canEdit: boolean
}

export function TokenSettingsForm({ currentMinBalance, canEdit }: TokenSettingsFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [minTokenBalance, setMinTokenBalance] = useState(currentMinBalance)
    const router = useRouter()

    useEffect(() => {
        setMinTokenBalance(currentMinBalance)
    }, [currentMinBalance])

    const formattedCurrentBalance = (() => {
        const raw = currentMinBalance.trim()
        if (!raw) return '0'
        if (!/^\d+(\.\d+)?$/.test(raw)) return raw
        const integerPart = raw.split('.')[0] ?? '0'
        return new Intl.NumberFormat('es-ES').format(BigInt(integerPart))
    })()

    const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()

        if (!canEdit) {
            toast.error('Please sign in to update token gate settings')
            return
        }

        const formData = new FormData(e.currentTarget)

        setIsSubmitting(true)
        const result = await updateTokenGateSettings(formData)
        setIsSubmitting(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            const submitted = formData.get('minTokenBalance')
            if (typeof submitted === 'string') {
                setMinTokenBalance(submitted)
            }
            toast.success('Token requirement updated')
            router.refresh()
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
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="minTokenBalance" className="block text-xs font-mono text-zinc-500 mb-2">
                        Minimum BRND tokens required
                    </label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            name="minTokenBalance"
                            id="minTokenBalance"
                            value={minTokenBalance}
                            disabled={!canEdit || isSubmitting}
                            min={0}
                            placeholder="5000000"
                            onChange={(e) => setMinTokenBalance(e.target.value)}
                            className="flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex items-center gap-1">
                            {presets.map((preset) => {
                                const isActive = minTokenBalance === preset.value

                                return (
                                    <Button
                                        key={preset.value}
                                        type="button"
                                        variant={isActive ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => {
                                            setMinTokenBalance(preset.value)
                                        }}
                                        className={
                                            isActive
                                                ? 'text-xs font-mono'
                                                : 'text-xs font-mono text-zinc-400 hover:text-white'
                                        }
                                    >
                                        {preset.label.replace(' BRND', '').replace('Disabled ', '')}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    variant="secondary"
                    disabled={!canEdit || isSubmitting}
                    className="w-full"
                >
                    {isSubmitting ? 'Saving...' : 'Update Requirement'}
                </Button>
            </form>

            <p className="mt-4 text-xs text-zinc-600 font-mono">
                Current: {formattedCurrentBalance} BRND
                {currentMinBalance === '0' && ' (Token gate disabled)'}
            </p>
        </Card>
    )
}
