"use client"

import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { AlertCircle, Info, MessageSquare, Image as ImageIcon, Wallet, Coins } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState, useActionState } from "react"
import { applyBrand, State } from "@/lib/actions/brand-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { useTokenGate } from "@/hooks/useTokenGate"
import { useRouter } from "next/navigation"
import { useSignMessage } from "wagmi"
import { buildWalletSignatureMessage } from "@/lib/wallet-signature"
import { useBrandForm } from "@/hooks/useBrandForm"
import { EMPTY_BRAND_FORM, type CategoryOption } from "@/types/brand"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

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
    const [activeTab, setActiveTab] = useState("farcaster")
    const initialState: State = { message: null, errors: {} }
    const [state, formAction, isPending] = useActionState<State, FormData>(applyBrand, initialState)

    const router = useRouter()

    const { address } = useTokenGate()
    const { signMessageAsync } = useSignMessage()

    const { formData, setFormData, setField, handleInputChange, queryType } = useBrandForm(EMPTY_BRAND_FORM)
    const editorCategories = sortCategoriesByCanonicalOrder(
        categories.filter((category) =>
            CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
        )
    )

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

    const queryTypeValue = Number(queryType) === 1 ? 1 : 0

    const getFieldError = (key: keyof typeof formData) => state.errors?.[key]?.[0]

    return (
        <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
            {state.message && !state.success && (
                <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-4 flex items-center gap-3 text-red-400 text-sm mb-6">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{state.message}</p>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="farcaster" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Farcaster
                    </TabsTrigger>
                    <TabsTrigger value="basic" className="gap-2">
                        <Info className="h-4 w-4" />
                        Basic
                    </TabsTrigger>
                    <TabsTrigger value="media" className="gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Media
                    </TabsTrigger>
                    <TabsTrigger value="wallet" className="gap-2">
                        <Wallet className="h-4 w-4" />
                        Wallet
                    </TabsTrigger>
                    <TabsTrigger value="token" className="gap-2">
                        <Coins className="h-4 w-4" />
                        Token
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="farcaster" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Query Type</label>
                            <Select
                                value={formData.queryType}
                                onValueChange={(value) => setField("queryType", value)}
                                disabled={isSigning || isPending}
                            >
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Channel</SelectItem>
                                    <SelectItem value="1">Profile</SelectItem>
                                </SelectContent>
                            </Select>
                            {getFieldError("queryType") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("queryType")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">
                                {queryTypeValue === 0 ? "Channel" : "Profile"}
                            </label>
                            <Input
                                name={queryTypeValue === 0 ? "channel" : "profile"}
                                value={queryTypeValue === 0 ? formData.channel : formData.profile}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {queryTypeValue === 0 && getFieldError("channel") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("channel")}</p>
                            )}
                            {queryTypeValue === 1 && getFieldError("profile") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("profile")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Owner FID</label>
                            <Input
                                name="ownerFid"
                                value={formData.ownerFid}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("ownerFid") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("ownerFid")}</p>
                            )}
                        </div>
                        <div className="flex items-end">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleFetchData}
                                disabled={isSigning || isPending || isFetching || (!formData.channel && !formData.profile)}
                            >
                                {isFetching ? "Fetching..." : "Fetch Farcaster"}
                            </Button>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-mono text-zinc-500">Warpcast URL</label>
                            <Input
                                name="warpcastUrl"
                                value={formData.warpcastUrl}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("warpcastUrl") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("warpcastUrl")}</p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-mono text-zinc-500">Follower count</label>
                            <Input
                                name="followerCount"
                                value={formData.followerCount}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("followerCount") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("followerCount")}</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="basic" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Brand name</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("name") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("name")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Website</label>
                            <Input
                                name="url"
                                value={formData.url}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("url") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("url")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Category</label>
                            <Select
                                value={formData.categoryId || "none"}
                                onValueChange={(value) => setField("categoryId", value === "none" ? "" : value)}
                                disabled={isSigning || isPending}
                            >
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No category</SelectItem>
                                    {editorCategories.map((category) => (
                                        <SelectItem key={category.id} value={String(category.id)}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {getFieldError("categoryId") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("categoryId")}</p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-mono text-zinc-500">Description</label>
                            <Textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2 min-h-[120px]"
                            />
                            {getFieldError("description") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("description")}</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="media" className="space-y-4">
                    <div>
                        <label className="text-xs font-mono text-zinc-500">Image URL</label>
                        <Input
                            name="imageUrl"
                            value={formData.imageUrl}
                            onChange={handleInputChange}
                            disabled={isSigning || isPending}
                            className="mt-2"
                        />
                        {getFieldError("imageUrl") && (
                            <p className="mt-2 text-xs text-red-400">{getFieldError("imageUrl")}</p>
                        )}
                    </div>
                    {formData.imageUrl && (
                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/40 p-3">
                            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-zinc-900">
                                <Image src={formData.imageUrl} alt="Logo preview" fill className="object-cover" unoptimized />
                            </div>
                            <div className="flex-1 text-xs font-mono text-zinc-500">
                                Preview · Remote URL
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="wallet" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Owner wallet</label>
                            <Input
                                name="ownerPrimaryWallet"
                                value={formData.ownerPrimaryWallet}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("ownerPrimaryWallet") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("ownerPrimaryWallet")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Owner wallet FID</label>
                            <Input
                                name="ownerWalletFid"
                                value={formData.ownerWalletFid}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                            {getFieldError("ownerWalletFid") && (
                                <p className="mt-2 text-xs text-red-400">{getFieldError("ownerWalletFid")}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Wallet address</label>
                            <Input
                                name="walletAddress"
                                value={formData.walletAddress}
                                onChange={handleInputChange}
                                disabled
                                className="mt-2"
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="token" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Token contract address</label>
                            <Input
                                name="tokenContractAddress"
                                value={formData.tokenContractAddress}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-mono text-zinc-500">Token ticker</label>
                            <Input
                                name="tokenTicker"
                                value={formData.tokenTicker}
                                onChange={handleInputChange}
                                disabled={isSigning || isPending}
                                className="mt-2"
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Submit Button */}
            <div className="pt-4">
                <SubmitButton isSigning={isSigning} isPending={isPending} />
            </div>
        </form>
    )
}
