'use client'

import { useFormStatus } from 'react-dom'
import { addAllowedWallet } from '@/lib/actions/wallet-actions'
import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardTitle } from '@/components/ui/card'

type SubmitButtonProps = {
    disabled: boolean
}

function SubmitButton({ disabled }: SubmitButtonProps) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            variant="secondary"
            disabled={pending || disabled}
            className="w-full"
        >
            <Plus className="w-4 h-4" />
            {pending ? 'Adding...' : 'Add Wallet'}
        </Button>
    )
}

type AddWalletFormProps = {
    canEdit: boolean
}

export function AddWalletForm({ canEdit }: AddWalletFormProps) {
    const formRef = useRef<HTMLFormElement>(null)

    async function handleSubmit(formData: FormData) {
        if (!canEdit) {
            toast.error('Unauthorized')
            return
        }

        const result = await addAllowedWallet(formData)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Wallet added to allowlist')
            formRef.current?.reset()
        }
    }

    return (
        <Card>
            <CardTitle>Add Wallet to Allowlist</CardTitle>

            <form ref={formRef} action={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="address" className="block text-xs font-mono text-zinc-500 mb-2">
                            Wallet Address *
                        </label>
                        <Input
                            type="text"
                            name="address"
                            id="address"
                            required
                            disabled={!canEdit}
                            placeholder="0x..."
                            pattern="^0x[a-fA-F0-9]{40}$"
                        />
                    </div>

                    <div>
                        <label htmlFor="label" className="block text-xs font-mono text-zinc-500 mb-2">
                            Label (Optional)
                        </label>
                        <Input
                            type="text"
                            name="label"
                            id="label"
                            disabled={!canEdit}
                            placeholder="e.g. Team Wallet"
                        />
                    </div>
                </div>

                <SubmitButton disabled={!canEdit} />
            </form>
        </Card>
    )
}
