"use client"

import { useEffect } from "react"

type ClipboardLike = {
  writeText: (text: string) => Promise<void>
}

export function ClipboardPolyfill() {
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") {
      return
    }

    if (!("clipboard" in navigator)) {
      const fallbackClipboard: ClipboardLike = {
        writeText: (text: string) =>
          new Promise((resolve, reject) => {
            try {
              const textarea = document.createElement("textarea")
              textarea.value = text
              textarea.style.position = "fixed"
              textarea.style.opacity = "0"
              document.body.appendChild(textarea)
              textarea.select()

              const ok = document.execCommand("copy")
              document.body.removeChild(textarea)
              if (ok) {
                resolve()
              } else {
                reject(new Error("Clipboard API unavailable"))
              }
            } catch (error) {
              reject(error)
            }
          }),
      }

      try {
        Object.defineProperty(navigator, "clipboard", {
          value: fallbackClipboard,
          configurable: true,
        })
      } catch {
        // Ignore if the property is non-configurable in this browser.
      }
    }
  }, [])

  return null
}
