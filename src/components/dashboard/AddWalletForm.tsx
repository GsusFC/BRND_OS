'use client'

import { useFormStatus } from 'react-dom'
import { addAllowedWallet } from '@/lib/actions/wallet-actions'
import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold font-mono text-sm uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
            <Plus className="w-4 h-4" />
            {pending ? 'Adding...' : 'Add Wallet'}
        </button>
    )
}

export function AddWalletForm() {
    const formRef = useRef<HTMLFormElement>(null)

    async function handleSubmit(formData: FormData) {
        const result = await addAllowedWallet(formData)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Wallet added to allowlist')
            formRef.current?.reset()
        }
    }

    return (
        <form ref={formRef} action={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white font-display uppercase mb-4">
                Add Wallet to Allowlist
            </h2>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label htmlFor="address" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-2">
                        Wallet Address *
                    </label>
                    <input
                        type="text"
                        name="address"
                        id="address"
                        required
                        placeholder="0x..."
                        pattern="^0x[a-fA-F0-9]{40}$"
                        className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono text-sm transition-colors"
                    />
                </div>

                <div className="sm:w-64">
                    <label htmlFor="label" className="block text-xs font-mono font-medium text-zinc-500 uppercase mb-2">
                        Label (Optional)
                    </label>
                    <input
                        type="text"
                        name="label"
                        id="label"
                        placeholder="e.g. Team Wallet"
                        className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono text-sm transition-colors"
                    />
                </div>

                <div className="sm:self-end">
                    <SubmitButton />
                </div>
            </div>
        </form>
    )
}
