import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // BRND Input styles
        "w-full h-[41px] px-3",
        "bg-[#0D0D0D] border-[0.75px] border-[#484E55] rounded-lg",
        "font-sans font-extralight text-sm leading-[18px] text-white",
        "placeholder:text-zinc-500",
        "transition-colors outline-none",
        "focus:border-white focus:ring-1 focus:ring-white",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Hide number spinners
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        // Error state
        "aria-invalid:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
