import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-800 text-zinc-400 border-zinc-700",
        success:
          "bg-green-950/50 text-green-400 border-green-900/50",
        warning:
          "bg-yellow-950/50 text-yellow-400 border-yellow-900/50",
        destructive:
          "bg-red-950/50 text-red-400 border-red-900/50",
        info:
          "bg-blue-950/50 text-blue-400 border-blue-900/50",
        brand:
          "bg-gradient-to-r from-yellow-500/10 via-red-500/10 to-blue-500/10 text-white border-white/20",
        outline:
          "bg-transparent text-zinc-400 border-zinc-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
