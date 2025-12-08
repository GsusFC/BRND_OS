import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-bold leading-[125%] transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-white/30",
  {
    variants: {
      variant: {
        // Primary: Glass effect with white border (BRND default)
        default:
          "bg-black/75 backdrop-blur-xl text-white border border-white hover:bg-black/85 active:bg-black/90 disabled:border-zinc-600",
        // Secondary: Solid white (for CTAs)
        secondary:
          "bg-white text-black hover:bg-zinc-200 active:bg-zinc-300 disabled:bg-zinc-600 disabled:text-zinc-400",
        // Ghost: Outlined
        ghost:
          "bg-transparent text-zinc-400 border border-zinc-800 hover:bg-black/50 hover:text-white hover:border-zinc-700 active:bg-black/75 disabled:border-zinc-800/50",
        // Danger: Glass with red text
        destructive:
          "bg-black/75 backdrop-blur-xl text-red-400 hover:bg-red-950/50 hover:text-red-300 active:bg-red-950/75",
        // Brand: Gradient border (uses CSS class) - z-10 ensures content is above ::after mask
        brand:
          "btn-brand-gradient relative z-0 font-display font-black uppercase tracking-wide text-white isolate",
        // Brand Light: White overlay on BRND gradient
        "brand-light":
          "btn-brand-light font-display font-black uppercase tracking-wide text-black",
        // Brand color buttons with gradient borders
        green:
          "btn-success-gradient backdrop-blur-xl text-[#00FF00]",
        yellow:
          "btn-yellow-gradient backdrop-blur-xl text-[#FFF100]",
        red:
          "btn-red-gradient backdrop-blur-xl text-[#FF0000]",
        blue:
          "btn-blue-gradient backdrop-blur-xl text-[#0C00FF]",
        // Link style
        link: "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[47px] px-6 text-lg rounded-lg",        // 47px, 8px radius (BRND spec)
        sm: "h-9 px-4 text-sm rounded-md gap-1.5",          // 36px, 6px radius
        lg: "h-14 px-8 text-xl rounded-[14px] gap-2.5",     // 56px, 14px radius
        icon: "size-[47px] rounded-lg",
        "icon-sm": "size-9 rounded-md",
        "icon-lg": "size-14 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
