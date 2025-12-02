import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { HeroSection } from "@/components/landing/HeroSection"
import { PodiumStack } from "@/components/landing/PodiumStack"
import { PodiumCarouselGSAP } from "@/components/landing/PodiumCarouselGSAP"
import { CredibilityTabs } from "@/components/landing/CredibilityTabs"
import { getRecentPodiums } from "@/lib/api/podiums"

export default async function LandingPage() {
    const session = await auth()
    // if (session) redirect("/dashboard")

    const [t, podiums] = await Promise.all([
        getTranslations('landing'),
        getRecentPodiums()
    ])

    return (
        <div className="min-h-screen bg-background font-sans">
            {/* Hero Section */}
            <HeroSection isAuthenticated={!!session} />

            {/* Live Podiums Carousel (GSAP) */}
            <PodiumCarouselGSAP initialPodiums={podiums} />

            {/* Credibility Tabs Section */}
            <CredibilityTabs />

            {/* Features Section */}
            <section className="border-t border-border bg-surface/50 px-4 py-24">
                <div className="mx-auto max-w-6xl">
                    <h2 className="mb-16 text-center text-3xl font-bold text-white md:text-4xl">
                        {t('features.title')}
                    </h2>
                    
                    <div className="grid gap-8 md:grid-cols-3">
                        {(['feature1', 'feature2', 'feature3'] as const).map((key) => (
                            <div key={key} className="rounded-2xl border border-border bg-surface p-8">
                                <div className="mb-4 h-12 w-12 rounded-xl bg-purple-600/20" />
                                <h3 className="mb-2 text-xl font-bold text-white">
                                    {t(`features.${key}.title`)}
                                </h3>
                                <p className="text-zinc-400">
                                    {t(`features.${key}.description`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Screenshots / Demo Section */}
            <section className="border-t border-border px-4 py-24">
                <div className="mx-auto max-w-6xl">
                    <h2 className="mb-16 text-center text-3xl font-bold text-white md:text-4xl">
                        {t('screenshots.title')}
                    </h2>
                    
                    <div className="flex justify-center">
                        <div className="h-[600px] w-[300px] rounded-3xl border border-border bg-surface/50">
                            <p className="flex h-full items-center justify-center text-zinc-500">
                                {t('screenshots.placeholder')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>


            {/* Footer */}
            <footer className="border-t border-border px-4 py-8">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                        <Image
                            src="/logo.svg"
                            alt="BRND"
                            width={80}
                            height={28}
                            className="h-6 w-auto opacity-50"
                        />
                        <p className="text-sm text-zinc-500">
                            {t('footer.rights', { year: new Date().getFullYear() })}
                        </p>
                        <LocaleSwitcher />
                    </div>
                </div>
            </footer>
        </div>
    )
}
