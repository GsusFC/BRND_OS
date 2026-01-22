"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react"
import { useActionState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useSignMessage } from "wagmi"
import { AlertCircle, Coins, Image as ImageIcon, Info, MessageSquare, Wallet } from "lucide-react"

import { applyBrand, type State } from "@/lib/actions/brand-actions"
import { fetchFarcasterData } from "@/lib/actions/farcaster-actions"
import { buildWalletSignatureMessage } from "@/lib/wallet-signature"
import { useTokenGate } from "@/hooks/useTokenGate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { brandFormSchema, type BrandFormValues } from "@/lib/validations/brand-form"
import { EMPTY_BRAND_FORM, type CategoryOption } from "@/types/brand"
import { CANONICAL_CATEGORY_NAMES, sortCategoriesByCanonicalOrder } from "@/lib/brand-categories"

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024
const COMPRESSED_MAX_BYTES = 1024 * 1024

const compressImage = async (file: File) => {
    const imageBitmap = await createImageBitmap(file)
    const canvas = document.createElement("canvas")
    const maxSize = 512
    const ratio = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height, 1)

    canvas.width = Math.round(imageBitmap.width * ratio)
    canvas.height = Math.round(imageBitmap.height * ratio)

    const context = canvas.getContext("2d")
    if (!context) return file

    context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height)

    return new Promise<File>((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    resolve(file)
                    return
                }
                resolve(new File([blob], file.name, { type: "image/jpeg" }))
            },
            "image/jpeg",
            0.9
        )
    })
}

type WalletNonceResponse = {
    nonce: string
    expiresAt: number
    origin: string
}

type UploadMode = "url" | "file"

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
    const [logoMode, setLogoMode] = useState<UploadMode>("url")
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [logoUploadState, setLogoUploadState] = useState<"idle" | "compressing" | "uploading" | "success" | "error">("idle")
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

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

    const queryType = form.watch("queryType")
    const imageUrl = form.watch("imageUrl")
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

    useEffect(() => {
        if (logoMode !== "url") return
        setLogoPreview(imageUrl || null)
    }, [imageUrl, logoMode])

    useEffect(() => {
        return () => {
            if (logoPreview?.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview)
            }
        }
    }, [logoPreview])

    const resetLogoState = () => {
        setLogoUploadError(null)
        setLogoUploadState("idle")
    }

    const handleLogoModeChange = (mode: UploadMode) => {
        setLogoMode(mode)
        resetLogoState()
        if (mode === "url") {
            setLogoPreview(imageUrl || null)
        } else {
            setLogoPreview(null)
        }
    }

    const handleLogoFileUpload = async (file: File) => {
        resetLogoState()
        if (file.size > MAX_LOGO_SIZE_BYTES) {
            setLogoUploadError("File is too large. Max 5MB.")
            setLogoUploadState("error")
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setLogoPreview(previewUrl)
        setLogoUploadState("compressing")

        const compressed = await compressImage(file)
        if (compressed.size > COMPRESSED_MAX_BYTES) {
            setLogoUploadError("Image is still larger than 1MB after compression.")
            setLogoUploadState("error")
            return
        }

        setLogoUploadState("uploading")
        try {
            const payload = new FormData()
            payload.append("file", compressed)
            const response = await fetch("/api/admin/upload/logo", {
                method: "POST",
                body: payload,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(data?.error || "Failed to upload logo.")
            }
            const nextUrl = data?.imageUrl || data?.ipfsUrl || data?.httpUrl || ""
            form.setValue("imageUrl", nextUrl, { shouldValidate: true })
            setLogoUploadState("success")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload logo."
            setLogoUploadError(message)
            setLogoUploadState("error")
        }
    }

    const handleLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        await handleLogoFileUpload(file)
    }

    const handleLogoDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const file = event.dataTransfer.files?.[0]
        if (!file) return
        await handleLogoFileUpload(file)
    }

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

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="w-fit">
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
                            <FormField
                                control={form.control}
                                name="queryType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Query Type</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange}>
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
                                            <Input {...field} className="mt-2" />
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
                                        <FormLabel className="text-xs font-mono text-zinc-500">Owner FID</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
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
                                    disabled={isPending || isSigning || isFetching || !channelOrProfile}
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
                                            <Input {...field} className="mt-2" />
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
                                            <Input {...field} className="mt-2" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="basic" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Brand name</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
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
                                            <Input {...field} className="mt-2" />
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
                                            <Select value={field.value} onValueChange={field.onChange}>
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
                                            <Textarea {...field} className="mt-2 min-h-[120px]" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="media" className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant={logoMode === "url" ? "default" : "secondary"}
                                onClick={() => handleLogoModeChange("url")}
                            >
                                Use URL
                            </Button>
                            <Button
                                type="button"
                                variant={logoMode === "file" ? "default" : "secondary"}
                                onClick={() => handleLogoModeChange("file")}
                            >
                                Upload
                            </Button>
                        </div>

                        {logoMode === "url" ? (
                            <FormField
                                control={form.control}
                                name="imageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Image URL</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <div className="space-y-3">
                                <div
                                    className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={handleLogoDrop}
                                >
                                    <div className="space-y-2">
                                        <p>Drag & drop image here</p>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => fileInput?.click()}
                                        >
                                            Browse files
                                        </Button>
                                    </div>
                                </div>
                                <input
                                    ref={setFileInput}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleLogoFileChange}
                                />
                                {logoUploadState !== "idle" && (
                                    <div className="text-xs text-zinc-500">
                                        {logoUploadState === "compressing" && "Compressing image..."}
                                        {logoUploadState === "uploading" && "Uploading image..."}
                                        {logoUploadState === "success" && "Upload complete."}
                                        {logoUploadState === "error" && (logoUploadError || "Upload failed.")}
                                    </div>
                                )}
                            </div>
                        )}

                        {logoPreview && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-800">
                                        <Image src={logoPreview} alt="Logo preview" fill className="object-cover" />
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        Preview · {logoMode === "url" ? "Remote URL" : "Uploaded file"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="wallet" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="ownerPrimaryWallet"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Owner wallet</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
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
                                        <FormLabel className="text-xs font-mono text-zinc-500">Owner wallet FID</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="walletAddress"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs font-mono text-zinc-500">Brand wallet</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" readOnly />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="token" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="tokenContractAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-mono text-zinc-500">Token contract</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="mt-2" />
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
                                            <Input {...field} className="mt-2" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

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
