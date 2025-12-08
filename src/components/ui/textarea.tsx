import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-lg bg-[#0D0D0D] border-[0.75px] border-[#484E55] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white focus:ring-1 focus:ring-white transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
