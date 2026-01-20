"use client"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState, useActionState } from "react"
import { applyBrand, State } from "@/lib/actions/brand-actions"
import { Button } from "@/components/ui/button"
import { useTokenGate } from "@/hooks/useTokenGate"
import { useRouter } from "next/navigation"
import { useSignMessage } from "wagmi"
import { buildWalletSignatureMessage } from "@/lib/wallet-signature"
import { BrandFormFields } from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"
import { EMPTY_BRAND_FORM, type CategoryOption } from "@/types/brand"

type WalletNonceResponse = {
    nonce: string
    expiresAt: number
    origin: string
}

function SubmitButton({ isSigning, isPending }: { isSigning: boolean; isPending: boolean }) {
    const label = isPending ? "Submitting..." : isSigning ? "Signing..." : "Submit Application"

    return (
        <Button
            type="submit"
            variant="secondary"
            disabled={isPending || isSigning}
            className="w-full"
        >
            {label}
        </Button>
    )
}

export function ApplyForm({ categories }: { categories: CategoryOption[] }) {
    const [isFetching, setIsFetching] = useState(false)
    const [isSigning, setIsSigning] = useState(false)
    const initialState: State = { message: null, errors: {} }
    const [state, formAction, isPending] = useActionState<State, FormData>(applyBrand, initialState)

    const router = useRouter()

    const { address } = useTokenGate()
    const { signMessageAsync } = useSignMessage()

    const { formData, setFormData, setField, handleInputChange, queryType } = useBrandForm(EMPTY_BRAND_FORM)

    useEffect(() => {
        const nextAddress = address ?? ""
        if (formData.walletAddress !== nextAddress) {
            setField("walletAddress", nextAddress)
        }
    }, [address, formData.walletAddress, setField])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (isSigning || isPending) return

        if (!address) {
            toast.error("Conecta tu wallet para firmar la solicitud.")
            return
        }

        setIsSigning(true)

        try {
            const nonceResponse = await fetch("/api/wallet/nonce", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
            })

            if (!nonceResponse.ok) {
                const payload = (await nonceResponse.json().catch(() => null)) as { error?: string } | null
                const errorMessage = payload?.error || "No se pudo generar el nonce de firma."
                throw new Error(errorMessage)
            }

            const noncePayload = (await nonceResponse.json()) as WalletNonceResponse
            if (!noncePayload?.nonce || !noncePayload.expiresAt || !noncePayload.origin) {
                throw new Error("Respuesta inválida al generar nonce.")
            }

            const message = buildWalletSignatureMessage({
                address,
                nonce: noncePayload.nonce,
                expiresAt: noncePayload.expiresAt,
                origin: noncePayload.origin,
            })

            const signature = await signMessageAsync({ message })
            if (!signature || !signature.startsWith("0x")) {
                throw new Error("Firma inválida.")
            }

            const data = new FormData(event.currentTarget)
            data.set("walletAddress", address)
            data.set("walletSignature", signature)
            data.set("walletNonce", noncePayload.nonce)

            await formAction(data)
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo firmar la solicitud."
            toast.error(message)
        } finally {
            setIsSigning(false)
        }
    }

    useEffect(() => {
        if (state.success) {
            if (state.message) {
                toast.success(state.message)
            }
            router.push("/apply/success")
            return
        }

        if (!state.message) return
        toast.error(state.message)
    }, [router, state.message, state.success])

    const handleFetchData = async () => {
        const value = queryType === "0" ? formData.channel : formData.profile
        if (!value) return

        setIsFetching(true)
        try {
            const result = await fetchFarcasterData(queryType, value)

            if (result.success && result.data) {
                setFormData(prev => ({
                    ...prev,
                    name: result.data.name || prev.name,
                    description: result.data.description || prev.description,
                    imageUrl: result.data.imageUrl || prev.imageUrl,
                    followerCount: result.data.followerCount === undefined || result.data.followerCount === null
                        ? prev.followerCount
                        : String(result.data.followerCount),
                    warpcastUrl: result.data.warpcastUrl || prev.warpcastUrl,
                    url: result.data.url || prev.url
                }))
                toast.success("Data fetched from Farcaster!")
            } else if (result.error) {
                toast.error(result.error)
            }
        } catch (error) {
            console.error(error)
            toast.error("An unexpected error occurred.")
        } finally {
            setIsFetching(false)
        }
    }

    return (
        <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
            {state.message && !state.success && (
                <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-4 flex items-center gap-3 text-red-400 text-sm mb-6">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{state.message}</p>
                </div>
            )}

            <BrandFormFields
                formData={formData}
                onChange={handleInputChange}
                errors={state.errors}
                categories={categories}
                onAutoFill={handleFetchData}
                isAutoFilling={isFetching}
                disabled={isSigning || isPending}
                walletReadOnly
            />

            {/* Submit Button */}
            <div className="pt-4">
                <SubmitButton isSigning={isSigning} isPending={isPending} />
            </div>
        </form>
    )
}
