import prisma from "@/lib/prisma"
import { ApplyForm } from "@/components/brands/ApplyForm"
import Link from "next/link"
import Image from "next/image"

export default async function ApplyPage() {
    const categories = await prisma.category.findMany()

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
            <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <Link href="/" className="inline-block mb-8">
                        <Image
                            src="/logo.svg"
                            alt="BRND Logo"
                            width={160}
                            height={56}
                            className="h-14 w-auto"
                            priority
                        />
                    </Link>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-display uppercase mb-4">
                        Apply for Listing
                    </h2>
                    <p className="text-lg text-zinc-400 font-mono max-w-2xl mx-auto">
                        Join the BRND ecosystem. Submit your brand details below for review.
                        Approved brands gain access to our voting and rewards platform.
                    </p>
                </div>

                <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFF100] via-[#FF0000] to-[#0C00FF]" />
                    <ApplyForm categories={categories} />
                </div>

                <div className="mt-12 text-center">
                    <p className="text-sm text-zinc-600 font-mono">
                        &copy; {new Date().getFullYear()} BRND. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
