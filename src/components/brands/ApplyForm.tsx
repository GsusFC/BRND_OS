"use client"

import { useEffect, useMemo, useState } from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useSignMessage } from "wagmi"
import { AlertCircle } from "lucide-react"

import { applyBrand, type State } from "@/lib/actions/brand-actions"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { buildWalletSignatureMessage } from "@/lib/wallet-signature"
import { useTokenGate } from "@/hooks/useTokenGate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { brandFormSchema, type BrandFormValues, toQueryType } from "@/lib/validations/brand-form"
import { BrandFormTabs } from "@/components/brands/forms"
import { LogoUploader } from "@/components/dashboard/applications/shared"
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
        <Button type="submit" variant="secondary" disabled={isPending || isSigning} className="w-full">
            {label}
        </Button>
    )
}

export function ApplyForm({ categories }: { categories: CategoryOption[] }) {
    const initialState: State = { message: null, errors: {} }
    const [state, formAction, isPending] = useActionState<State, FormData>(applyBrand, initialState)

    const [isSigning, setIsSigning] = useState(false)
    const [activeTab, setActiveTab] = useState("farcaster")
    const [isFetching, setIsFetching] = useState(false)

    const router = useRouter()
    const { address } = useTokenGate()
    const { signMessageAsync } = useSignMessage()

    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandFormSchema),
        defaultValues: {
            ...EMPTY_BRAND_FORM,
            queryType: "0",
            walletAddress: address ?? "",
        },
        mode: "onBlur",
    })

    const queryType = toQueryType(form.watch("queryType"))
    const channelOrProfile = queryType === "0" ? form.watch("channel") : form.watch("profile")

    const editorCategories = useMemo(
        () =>
            sortCategoriesByCanonicalOrder(
                categories.filter((category) =>
                    CANONICAL_CATEGORY_NAMES.includes(category.name as (typeof CANONICAL_CATEGORY_NAMES)[number])
                )
            ),
        [categories]
    )

    useEffect(() => {
        if (address) {
            form.setValue("walletAddress", address, { shouldValidate: false })
        }
    }, [address, form])

    useEffect(() => {
        if (!state?.errors) return
        Object.entries(state.errors).forEach(([key, messages]) => {
            if (!messages?.length) return
            form.setError(key as keyof BrandFormValues, { type: "server", message: messages[0] })
        })
    }, [form, state?.errors])

    useEffect(() => {
        if (state.success) {
            if (state.message) toast.success(state.message)
            router.push("/apply/success")
            return
        }
        if (state.message) toast.error(state.message)
    }, [router, state.message, state.success])

    const handleFetchData = async () => {
        const value = queryType === "0" ? form.getValues("channel") : form.getValues("profile")
        if (!value) return
        setIsFetching(true)
        try {
            const result = await fetchFarcasterData(queryType, value)
            if (result.success && result.data) {
                form.setValue("name", result.data.name || form.getValues("name"))
                form.setValue("description", result.data.description || form.getValues("description"))
                form.setValue("imageUrl", result.data.imageUrl || form.getValues("imageUrl"))
                form.setValue(
                    "followerCount",
                    result.data.followerCount === undefined || result.data.followerCount === null
                        ? form.getValues("followerCount")
                        : String(result.data.followerCount)
                )
                form.setValue("warpcastUrl", result.data.warpcastUrl || form.getValues("warpcastUrl"))
                form.setValue("url", result.data.url || form.getValues("url"))
                if (queryType === "1" && result.data.fid !== undefined && result.data.fid !== null) {
                    form.setValue("ownerFid", String(result.data.fid))
                }
            } else if (result.error) {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to fetch Farcaster data.")
        } finally {
            setIsFetching(false)
        }
    }

    const handleSubmit = form.handleSubmit(async (values) => {
        if (isSigning || isPending) return
        if (!address) {
            toast.error("Connect your wallet to sign the request.")
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

            const data = new FormData()
            Object.entries(values).forEach(([key, value]) => {
                data.set(key, value ?? "")
            })

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
    })

    const isDisabled = isPending || isSigning

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <BrandFormTabs value={activeTab} onValueChange={setActiveTab}>

                    {/* Farcaster Tab */}
                    <TabsContent value="farcaster" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="queryType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Query Type</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange} disabled={isDisabled}>
                                                <SelectTrigger className="mt-2 w-full">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">Channel</SelectItem>
                                                    <SelectItem value="1">Profile</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={queryType === "0" ? "channel" : "profile"}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">
                                            {queryType === "0" ? "Channel" : "Profile"}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ownerFid"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">
                                            {queryType === "1" ? "Brand FID (Profile)" : "Owner FID (Channel)"}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleFetchData}
                                    disabled={isDisabled || isFetching || !channelOrProfile}
                                >
                                    {isFetching ? "Fetching..." : "Fetch Farcaster"}
                                </Button>
                            </div>
                            <FormField
                                control={form.control}
                                name="warpcastUrl"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs font-mono text-zinc-500">Warpcast URL</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="followerCount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Follower Count</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    {/* Basic Info Tab */}
                    <TabsContent value="basic" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Brand name</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Website</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Category</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange} disabled={isDisabled}>
                                                <SelectTrigger className="mt-2 w-full">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {editorCategories.map((category) => (
                                                        <SelectItem key={category.id} value={String(category.id)}>
                                                            {category.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs font-mono text-zinc-500">Description</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} className="mt-2 min-h-[120px]" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    {/* Media Tab - Using shared LogoUploader */}
                    <TabsContent value="media" className="space-y-4">
                        <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-mono text-zinc-500">Brand Logo</FormLabel>
                                    <FormControl>
                                        <LogoUploader
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            disabled={isDisabled}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </TabsContent>

                    {/* Wallet Tab */}
                    <TabsContent value="wallet" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="ownerPrimaryWallet"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Guardian wallet</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={isDisabled} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ownerWalletFid"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Guardian fid</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="mt-2" disabled={isDisabled} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    {/* Token Tab */}
                    <TabsContent value="token" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="tokenContractAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Token contract</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="tokenTicker"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Token ticker</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" disabled={isDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>
                </BrandFormTabs>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="flex items-start gap-3 text-sm text-zinc-400">
                        <AlertCircle className="mt-0.5 h-4 w-4 text-zinc-500" />
                        <div>
                            <p className="text-white">Please double-check your information.</p>
                            <p>Submitting will trigger wallet verification and a review process.</p>
                        </div>
                    </div>
                </div>

                <SubmitButton isSigning={isSigning} isPending={isPending} />
            </form>
        </Form>
    )
}
