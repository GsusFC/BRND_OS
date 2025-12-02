'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, type Locale } from './config'

export function useChangeLocale() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const changeLocale = useCallback((newLocale: Locale) => {
        // Guardar en cookie
        document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=31536000`
        
        // Refrescar la página para aplicar el nuevo idioma
        startTransition(() => {
            router.refresh()
        })
    }, [router])

    return { changeLocale, isPending }
}
