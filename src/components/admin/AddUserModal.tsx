"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, User } from "lucide-react"

interface AddUserModalProps {
    isOpen: boolean
    onClose: () => void
    onAddUser: (userData: {
        fid: number
        username: string
        role: string
        avatar?: string
    }) => Promise<boolean>
}

export function AddUserModal({ isOpen, onClose, onAddUser }: AddUserModalProps) {
    const [step, setStep] = useState<"input" | "preview" | "role">("input")
    const [searchValue, setSearchValue] = useState("")
    const [searchError, setSearchError] = useState<string | null>(null)
    const [selectedUser, setSelectedUser] = useState<{
        fid: number
        username: string
        avatar?: string
        displayName?: string
        bio?: string
    } | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>("viewer")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSearch = async () => {
        if (!searchValue.trim()) return
        
        setIsLoading(true)
        setSearchError(null)
        
        try {
            const q = searchValue.trim()
            const res = await fetch(`/api/admin/farcaster/lookup?q=${encodeURIComponent(q)}`, {
                method: "GET",
                cache: "no-store",
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                const message = typeof body?.error === "string"
                    ? body.error
                    : `Lookup failed (HTTP ${res.status})`
                setSearchError(message)
                return
            }

            const json = await res.json().catch(() => null)
            const user = json?.user as {
                fid?: number
                username?: string
                displayName?: string
                avatar?: string
                bio?: string
            } | undefined

            if (!user || typeof user.fid !== "number" || typeof user.username !== "string") {
                setSearchError("Invalid response from lookup")
                return
            }

            setSelectedUser({
                fid: user.fid,
                username: user.username,
                avatar: typeof user.avatar === "string" ? user.avatar : undefined,
                displayName: typeof user.displayName === "string" ? user.displayName : undefined,
                bio: typeof user.bio === "string" ? user.bio : undefined,
            })
            setStep("preview")
        } catch (error) {
            console.error("Error fetching user:", error)
            setSearchError(error instanceof Error ? error.message : "Network error")
        } finally {
            setIsLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!selectedUser || isSubmitting) return

        setIsSubmitting(true)
        try {
            const ok = await onAddUser({
                fid: selectedUser.fid,
                username: selectedUser.username,
                role: selectedRole,
                avatar: selectedUser.avatar
            })

            if (!ok) return

            setStep("input")
            setSearchValue("")
            setSelectedUser(null)
            setSelectedRole("viewer")
            onClose()
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setStep("input")
        setSearchValue("")
        setSearchError(null)
        setSelectedUser(null)
        setSelectedRole("viewer")
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add New User
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {step === "input" && (
                        <>
                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-2 block">
                                    Search User
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="@username or FID"
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="flex-1"
                                    />
                                    <Button 
                                        onClick={handleSearch}
                                        disabled={!searchValue.trim() || isLoading}
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Search className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-zinc-500 mt-2">
                                    Enter a Farcaster username or FID to search
                                </p>

                                {searchError && (
                                    <p className="text-xs text-red-400 mt-2 font-mono">
                                        {searchError}
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {step === "preview" && selectedUser && (
                        <>
                            <div>
                                <p className="text-sm font-medium text-zinc-300 mb-3">User Found</p>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            {selectedUser.avatar ? (
                                                <Image
                                                    src={selectedUser.avatar}
                                                    alt={selectedUser.username}
                                                    width={48}
                                                    height={48}
                                                    sizes="48px"
                                                    className="w-12 h-12 rounded-full"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                                    <User className="w-6 h-6 text-zinc-400" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <p className="font-medium">@{selectedUser.username}</p>
                                                <p className="text-sm text-zinc-400">{selectedUser.displayName}</p>
                                                <p className="text-xs text-zinc-500 font-mono">FID {selectedUser.fid}</p>
                                            </div>
                                        </div>
                                        {selectedUser.bio && (
                                            <p className="text-xs text-zinc-500 mt-3">{selectedUser.bio}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-2 block">
                                    Role
                                </label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="viewer">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="info">Viewer</Badge>
                                                <span className="text-xs text-zinc-500">Dashboard + Intelligence access</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="limited">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="warning">Limited</Badge>
                                                <span className="text-xs text-zinc-500">Read-only access</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="admin">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="destructive">Admin</Badge>
                                                <span className="text-xs text-zinc-500">Full access</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep("input")} className="flex-1">
                                    Back
                                </Button>
                                <Button onClick={handleConfirm} className="flex-1" disabled={isSubmitting}>
                                    Add User
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}