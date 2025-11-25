import Link from "next/link"
import { CheckCircle } from "lucide-react"

export default function ApplySuccessPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">
                <div className="flex justify-center">
                    <div className="rounded-full bg-green-500/10 p-6 ring-1 ring-green-500/20">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight font-mono">Application Received</h1>
                    <p className="text-zinc-400 font-mono">
                        Thank you for submitting your brand to BRND. Our team will review your application shortly.
                    </p>
                </div>

                <div className="pt-8 border-t border-zinc-900">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-bold text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-mono uppercase tracking-wide"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        </div>
    )
}
