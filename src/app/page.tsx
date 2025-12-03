import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { Header } from "@/components/landing/Header"
import { HeroSection } from "@/components/landing/HeroSection"
import { PodiumStack } from "@/components/landing/PodiumStack"
import { PodiumCarouselGSAP } from "@/components/landing/PodiumCarouselGSAP"
import { CredibilityTabs } from "@/components/landing/CredibilityTabs"
import { ScreenshotsGallery } from "@/components/landing/ScreenshotsGallery"
import { BrndAttributes } from "@/components/landing/BrndAttributes"
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
            {/* Fixed Header */}
            <Header isAuthenticated={!!session} />

            {/* Hero Section */}
            <HeroSection />

            {/* Live Podiums Carousel (GSAP) */}
            <PodiumCarouselGSAP initialPodiums={podiums} />

            {/* Credibility Tabs Section */}
            <CredibilityTabs />

            {/* BRND Attributes Section */}
            <BrndAttributes />

            {/* Screenshots / Demo Section */}
            <ScreenshotsGallery />


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
