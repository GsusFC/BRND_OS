import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, LOCALE_COOKIE, type Locale } from './config'

export default getRequestConfig(async () => {
    // 1. Intentar obtener de cookie
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value as Locale | undefined
    
    if (cookieLocale && locales.includes(cookieLocale)) {
        return {
            locale: cookieLocale,
            messages: (await import(`../../messages/${cookieLocale}.json`)).default
        }
    }

    // 2. Detectar del header Accept-Language
    const headersList = await headers()
    const acceptLanguage = headersList.get('accept-language')
    
    if (acceptLanguage) {
        const browserLocale = acceptLanguage.split(',')[0].split('-')[0] as Locale
        if (locales.includes(browserLocale)) {
            return {
                locale: browserLocale,
                messages: (await import(`../../messages/${browserLocale}.json`)).default
            }
        }
    }

    // 3. Fallback a default
    return {
        locale: defaultLocale,
        messages: (await import(`../../messages/${defaultLocale}.json`)).default
    }
})
