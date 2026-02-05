"use client"

import { useState, useEffect, useCallback, type ChangeEvent, type DragEvent } from "react"
import Image from "next/image"
import { Upload, X, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024
const COMPRESSED_MAX_BYTES = 1024 * 1024
const LOGO_MAX_DIMENSION = 512

type UploadMode = "url" | "file"
type UploadState = "idle" | "compressing" | "uploading" | "success" | "error"

interface LogoUploaderProps {
    value: string
    onChange: (url: string) => void
    disabled?: boolean
    className?: string
}

async function compressImage(file: File): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, width, height)
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/webp", 0.9)
        )
        if (!blob) return file
        const name = file.name.replace(/\.[^.]+$/, ".webp")
        return new File([blob], name, { type: "image/webp" })
    } catch {
        return file
    }
}

export function LogoUploader({ value, onChange, disabled, className }: LogoUploaderProps) {
    const [mode, setMode] = useState<UploadMode>("url")
    const [preview, setPreview] = useState<string | null>(value || null)
    const [uploadState, setUploadState] = useState<UploadState>("idle")
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

    const resetUploadState = useCallback(() => {
        setUploadState("idle")
        setUploadError(null)
    }, [])

    const handleModeChange = (newMode: UploadMode) => {
        setMode(newMode)
        resetUploadState()
        if (newMode === "url") {
            setPreview(value || null)
        } else {
            setPreview(null)
        }
    }

    const handleFileUpload = async (file: File) => {
        resetUploadState()
        if (file.size > MAX_LOGO_SIZE_BYTES) {
            setUploadError("File is too large. Max 5MB.")
            setUploadState("error")
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setPreview(previewUrl)
        setUploadState("compressing")

        const compressed = await compressImage(file)
        if (compressed.size > COMPRESSED_MAX_BYTES) {
            setUploadError("Image is still larger than 1MB after compression.")
            setUploadState("error")
            return
        }

        setUploadState("uploading")
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
            onChange(nextUrl)
            setUploadState("success")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload logo."
            setUploadError(message)
            setUploadState("error")
        }
    }

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        await handleFileUpload(file)
    }

    const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        if (disabled) return
        const file = event.dataTransfer.files?.[0]
        if (!file) return
        await handleFileUpload(file)
    }

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
    }

    useEffect(() => {
        if (mode === "url") {
            setPreview(value || null)
        }
    }, [value, mode])

    useEffect(() => {
        return () => {
            if (preview?.startsWith("blob:")) {
                URL.revokeObjectURL(preview)
            }
        }
    }, [preview])

    const statusIcon = {
        idle: null,
        compressing: <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />,
        uploading: <Loader2 className="w-4 h-4 animate-spin text-blue-400" />,
        success: <Check className="w-4 h-4 text-emerald-400" />,
        error: <AlertCircle className="w-4 h-4 text-red-400" />,
    }

    const statusText = {
        idle: null,
        compressing: "Compressing...",
        uploading: "Uploading...",
        success: "Upload complete",
        error: uploadError || "Upload failed",
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Mode toggle */}
            <div className="flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "url" ? "default" : "secondary"}
                    onClick={() => handleModeChange("url")}
                    disabled={disabled}
                >
                    Use URL
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "file" ? "default" : "secondary"}
                    onClick={() => handleModeChange("file")}
                    disabled={disabled}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                </Button>
            </div>

            {/* URL input */}
            {mode === "url" && (
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    disabled={disabled}
                />
            )}

            {/* File upload drop zone */}
            {mode === "file" && (
                <div
                    className={cn(
                        "flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                        disabled
                            ? "border-zinc-800 bg-zinc-900/20 cursor-not-allowed"
                            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600 cursor-pointer"
                    )}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !disabled && fileInput?.click()}
                >
                    <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-zinc-500" />
                        <p className="text-sm text-zinc-400">
                            Drag & drop or click to browse
                        </p>
                        <p className="text-xs text-zinc-600">
                            Max 5MB · Auto-compressed to WebP
                        </p>
                    </div>
                </div>
            )}

            <input
                ref={setFileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />

            {/* Upload status */}
            {uploadState !== "idle" && (
                <div className={cn(
                    "flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg",
                    uploadState === "error" ? "bg-red-950/30 text-red-400" : "bg-zinc-800/50 text-zinc-400"
                )}>
                    {statusIcon[uploadState]}
                    {statusText[uploadState]}
                </div>
            )}

            {/* Preview */}
            {preview && (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 flex-shrink-0">
                        <Image
                            src={preview}
                            alt="Logo preview"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300 truncate">
                            {mode === "url" ? "Remote URL" : "Uploaded file"}
                        </p>
                        <p className="text-xs text-zinc-600 truncate">
                            {preview.substring(0, 50)}...
                        </p>
                    </div>
                    {!disabled && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                onChange("")
                                setPreview(null)
                                resetUploadState()
                            }}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
