export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
    en: 'English',
    es: 'Español'
}

// Detectar idioma del navegador
export function detectBrowserLocale(): Locale {
    if (typeof window === 'undefined') return defaultLocale
    
    const browserLang = navigator.language.split('-')[0]
    return locales.includes(browserLang as Locale) 
        ? (browserLang as Locale) 
        : defaultLocale
}

// Cookie name para persistir preferencia
export const LOCALE_COOKIE = 'NEXT_LOCALE'
