"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Edit, Check, X, Shield, Eye, Settings as SettingsIcon } from "lucide-react"

interface Permission {
    id: string
    name: string
    description: string
    category: "core" | "data" | "admin"
}

interface User {
    fid: number
    username: string
    avatar?: string | null
    role: string
    permissions: string[]
    is_active: boolean
}

interface PermissionEditorProps {
    user: User | null
    isOpen: boolean
    onClose: () => void
    onSave: (updatedUser: User) => Promise<boolean>
}

const allPermissions: Permission[] = [
    // Core permissions
    { id: "dashboard", name: "Dashboard", description: "View main analytics dashboard", category: "core" },
    { id: "intelligence", name: "Intelligence", description: "Access AI query system", category: "core" },
    
    // Data permissions
    { id: "users", name: "Users", description: "View user lists and profiles", category: "data" },
    { id: "brands", name: "Brands", description: "View brand lists and details", category: "data" },
    { id: "season-1", name: "Season 1", description: "Access Season 1 reports", category: "data" },
    
    // Admin permissions
    { id: "applications", name: "Applications", description: "Manage brand applications", category: "admin" },
    { id: "allowlist", name: "Token Gate", description: "Manage token gate settings", category: "admin" },
    { id: "add-brands", name: "Add Brands", description: "Add and edit brands", category: "admin" },
    { id: "access-control", name: "Access Control", description: "Manage user permissions", category: "admin" },
]

const roleTemplates = {
    viewer: {
        name: "Viewer",
        description: "Can view dashboard and intelligence data",
        permissions: ["dashboard", "intelligence", "users", "brands", "season-1"]
    },
    limited: {
        name: "Limited",
        description: "Basic dashboard access only",
        permissions: ["dashboard", "intelligence"]
    },
    admin: {
        name: "Admin",
        description: "Full access to all features",
        permissions: ["all"]
    }
}

function getPermissionIcon(category: string) {
    switch (category) {
        case "core": return <Eye className="w-4 h-4" />
        case "data": return <Shield className="w-4 h-4" />
        case "admin": return <SettingsIcon className="w-4 h-4" />
        default: return <Shield className="w-4 h-4" />
    }
}

export function PermissionEditor({ user, isOpen, onClose, onSave }: PermissionEditorProps) {
    const [selectedRole, setSelectedRole] = useState(user?.role || "viewer")
    const [customPermissions, setCustomPermissions] = useState<string[]>(
        user?.permissions || ["dashboard", "intelligence"]
    )
    const [mode, setMode] = useState<"template" | "custom">("template")
    const [isSaving, setIsSaving] = useState(false)

    const userFid = user?.fid
    const userRole = user?.role
    const userPermissions = user?.permissions
    const userPermissionsKey = Array.isArray(userPermissions) ? userPermissions.join("|") : ""

    useEffect(() => {
        if (!isOpen || typeof userFid !== "number") return

        setSelectedRole(userRole || "viewer")
        setCustomPermissions(Array.isArray(userPermissions) && userPermissions.length > 0
            ? userPermissions
            : ["dashboard", "intelligence"])
        setMode("template")
    }, [isOpen, userFid, userRole, userPermissions, userPermissionsKey])

    if (!user) return null

    const handleRoleChange = (role: string) => {
        setSelectedRole(role)
        if (role in roleTemplates) {
            const template = roleTemplates[role as keyof typeof roleTemplates]
            if (template.permissions[0] === "all") {
                setCustomPermissions(allPermissions.map(p => p.id))
            } else {
                setCustomPermissions(template.permissions)
            }
        }
    }

    const togglePermission = (permissionId: string) => {
        setCustomPermissions(prev => 
            prev.includes(permissionId)
                ? prev.filter(p => p !== permissionId)
                : [...prev, permissionId]
        )
    }

    const handleSave = async () => {
        if (isSaving) return

        const updatedUser: User = {
            ...user,
            role: selectedRole,
            permissions: customPermissions
        }

        setIsSaving(true)
        try {
            const ok = await onSave(updatedUser)
            if (ok) onClose()
        } finally {
            setIsSaving(false)
        }
    }

    const permissionsByCategory = allPermissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
            acc[permission.category] = []
        }
        acc[permission.category].push(permission)
        return acc
    }, {} as Record<string, Permission[]>)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="w-5 h-5" />
                        Edit Permissions: @{user.username}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* User Info */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                {user.avatar ? (
                                    <Image
                                        src={user.avatar}
                                        alt={user.username}
                                        width={40}
                                        height={40}
                                        sizes="40px"
                                        className="w-10 h-10 rounded-full"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">@{user.username}</p>
                                    <p className="text-xs text-zinc-500 font-mono">FID {user.fid}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mode Selection */}
                    <Tabs value={mode} onValueChange={(v) => setMode(v as "template" | "custom")}>
                        <TabsList>
                            <TabsTrigger value="template">Role Templates</TabsTrigger>
                            <TabsTrigger value="custom">Custom Permissions</TabsTrigger>
                        </TabsList>

                        <TabsContent value="template" className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-2 block">
                                    Select Role
                                </label>
                                <Select value={selectedRole} onValueChange={handleRoleChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(roleTemplates).map(([key, template]) => (
                                            <SelectItem key={key} value={key}>
                                                <div>
                                                    <p className="font-medium">{template.name}</p>
                                                    <p className="text-xs text-zinc-500">{template.description}</p>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Template Preview */}
                            <Card>
                                <CardTitle>Permissions Preview</CardTitle>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {customPermissions.map(permissionId => {
                                            const permission = allPermissions.find(p => p.id === permissionId)
                                            return permission ? (
                                                <Badge key={permissionId} variant="info">
                                                    {permission.name}
                                                </Badge>
                                            ) : null
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="custom" className="space-y-4">
                            {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                <Card key={category}>
                                    <CardTitle className="flex items-center gap-2 capitalize">
                                        {getPermissionIcon(category)}
                                        {category} Permissions
                                    </CardTitle>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {permissions.map(permission => (
                                                <div key={permission.id} className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => togglePermission(permission.id)}
                                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                            customPermissions.includes(permission.id)
                                                                ? "border-green-500 bg-green-500"
                                                                : "border-zinc-600"
                                                        }`}
                                                    >
                                                        {customPermissions.includes(permission.id) && (
                                                            <Check className="w-3 h-3 text-white" />
                                                        )}
                                                    </button>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{permission.name}</p>
                                                        <p className="text-xs text-zinc-500">{permission.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </TabsContent>
                    </Tabs>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose} className="flex-1">
                            <X className="w-4 h-4" />
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
                            <Check className="w-4 h-4" />
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}