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
                    <h1 className="text-3xl font-bold tracking-tight font-mono">Solicitud enviada</h1>
                    <p className="text-zinc-400 font-mono">
                        Hemos recibido tu solicitud de alta. Nuestro equipo la revisará en breve.
                    </p>
                    <p className="text-zinc-500 font-mono text-sm">
                        Estado: pendiente de revisión.
                    </p>
                </div>

                <div className="pt-8 border-t border-zinc-900">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-bold text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-mono uppercase tracking-wide"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    )
}
