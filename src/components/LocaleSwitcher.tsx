'use client'

import { useLocale } from 'next-intl'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { useChangeLocale } from '@/i18n/useLocale'
import { Globe, Loader2 } from 'lucide-react'

export function LocaleSwitcher() {
    const currentLocale = useLocale() as Locale
    const { changeLocale, isPending } = useChangeLocale()

    return (
        <div className="flex items-center gap-2">
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            ) : (
                <Globe className="w-4 h-4 text-zinc-500" />
            )}
            <select
                value={currentLocale}
                onChange={(e) => changeLocale(e.target.value as Locale)}
                disabled={isPending}
                className="bg-transparent text-zinc-400 text-sm font-mono border-none focus:outline-none cursor-pointer hover:text-white transition-colors disabled:opacity-50"
            >
                {locales.map((locale) => (
                    <option key={locale} value={locale} className="bg-zinc-900">
                        {localeNames[locale]}
                    </option>
                ))}
            </select>
        </div>
    )
}
