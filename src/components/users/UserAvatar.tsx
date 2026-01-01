"use client"

import Image from "next/image"
import { User } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
    src: string | null
    alt: string
    size?: number
    className?: string
}

export function UserAvatar({ src, alt, size = 96, className }: UserAvatarProps) {
    const [error, setError] = useState(false)

    if (!src || error) {
        return (
            <div 
                className={cn("flex items-center justify-center rounded-full bg-zinc-800 ring-2 ring-border", className)}
                style={{ width: size, height: size }}
            >
                <User className="text-zinc-500" style={{ width: size * 0.4, height: size * 0.4 }} />
            </div>
        )
    }

    return (
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            className={cn("rounded-full object-cover ring-2 ring-border", className)}
            onError={() => setError(true)}
        />
    )
}
