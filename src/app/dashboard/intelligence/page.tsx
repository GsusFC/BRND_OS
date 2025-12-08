"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Download, Copy, Sparkles, Bot, User, Trash2, FileSpreadsheet, Share2, ChevronDown, History, Zap } from "lucide-react"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// Dynamic imports para reducir bundle inicial (~100kB de recharts)
const DynamicChart = dynamic(
    () => import("@/components/intelligence/DynamicChart").then(mod => ({ default: mod.DynamicChart })),
    { loading: () => <div className="h-64 bg-zinc-900 rounded-xl animate-pulse" />, ssr: false }
)
const WeekLeaderboard = dynamic(
    () => import("@/components/intelligence/WeekLeaderboard").then(mod => ({ default: mod.WeekLeaderboard })),
    { loading: () => <div className="h-96 bg-zinc-900 rounded-xl animate-pulse" />, ssr: false }
)

import { useMessageHistory, useQueryCache, queryTemplates, type Message } from "@/lib/intelligence/hooks"
import { exportToCSV, exportToExcel, exportToJSON, generateShareableLink, copyToClipboard } from "@/lib/intelligence/export"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function IntelligencePage() {
    const { messages, addMessage, clearHistory, isLoaded } = useMessageHistory()
    const { getCached, setCached, getFrequentQueries } = useQueryCache()
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    // Auto-resize textarea when input changes
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '58px'
            const scrollHeight = textareaRef.current.scrollHeight
            textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px'
        }
    }, [input])

    // Cargar query compartida de URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const sharedQuery = params.get("q")
        if (sharedQuery) {
            try {
                const decoded = decodeURIComponent(atob(sharedQuery))
                setInput(decoded)
                // Limpiar URL
                window.history.replaceState({}, "", window.location.pathname)
            } catch {
                // Query inválida
            }
        }
    }, [])

    const frequentQueries = getFrequentQueries()

    const exampleQueries = frequentQueries.length > 0 ? frequentQueries : [
        "¿Cuántos usuarios votaron esta semana?",
        "Muéstrame las top 10 marcas por votos",
        "¿Qué marcas están creciendo más rápido?",
        "Top 20 usuarios más activos",
    ]

    const handleSubmit = async (question: string) => {
        if (!question.trim() || loading) return

        // Añadir mensaje del usuario
        addMessage({ role: "user", content: question })
        setInput("")
        setLoading(true)

        // Verificar cache
        const cached = getCached(question)
        if (cached) {
            addMessage({
                role: "assistant",
                content: cached.content,
                sql: cached.sql,
                data: cached.data,
                summary: cached.summary,
                rowCount: cached.rowCount,
                visualization: cached.visualization,
            })
            setLoading(false)
            toast.success("Resultado desde cache")
            return
        }

        try {
            const response = await fetch("/api/intelligence/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Query failed")
            }

            const assistantMessage: Omit<Message, "id" | "timestamp"> = {
                role: "assistant",
                content: data.summary || "Consulta ejecutada correctamente",
                sql: data.sql,
                data: data.data,
                summary: data.summary,
                rowCount: data.rowCount,
                visualization: data.visualization
            }

            const newMsg = addMessage(assistantMessage)
            setCached(question, newMsg)
        } catch (error) {
            addMessage({
                role: "assistant",
                content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                isError: true
            })
        } finally {
            setLoading(false)
        }
    }

    const handleTemplateSelect = (template: typeof queryTemplates[0]) => {
        // Por ahora, usar el template directamente con placeholders
        // En una versión más avanzada, mostrar un modal para llenar parámetros
        const filledTemplate = template.template
            .replace("{limit}", "10")
            .replace("{days}", "30")
            .replace("{period}", "este mes")
            .replace("{brand}", "[marca]")
            .replace("{brand1}", "[marca1]")
            .replace("{brand2}", "[marca2]")
            .replace("{username}", "[usuario]")
            .replace("{category}", "[categoría]")
            .replace("{currentRound}", "23")
            .replace("{previousRound}", "22")
        setInput(filledTemplate)
        setShowTemplates(false)
        
        // Focus textarea after template is loaded
        setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleExport = (messageId: string, format: "csv" | "excel" | "json", data: Record<string, unknown>[], question: string) => {
        const exportData = {
            question,
            data,
            timestamp: Date.now(),
        }

        switch (format) {
            case "csv":
                exportToCSV(data)
                toast.success("CSV exportado")
                break
            case "excel":
                exportToExcel(data)
                toast.success("Excel exportado")
                break
            case "json":
                exportToJSON(exportData)
                toast.success("JSON exportado")
                break
        }
        setShowExportMenu(null)
    }

    const handleShare = async (question: string) => {
        const link = generateShareableLink(question)
        const copied = await copyToClipboard(link)
        if (copied) {
            toast.success("Link copiado al portapapeles")
        }
    }

    const handleClearHistory = () => {
        clearHistory()
        toast.success("Historial limpiado")
    }

    if (!isLoaded) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    {messages.length > 0 && (
                        <Button
                            onClick={handleClearHistory}
                            variant="ghost"
                            size="sm"
                            className="bg-zinc-900/80 backdrop-blur border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900/50 text-xs font-mono"
                        >
                            <Trash2 className="w-3 h-3" />
                            Limpiar
                        </Button>
                    )}
                </div>

                <div className="bg-black/50 backdrop-blur-xl border border-white/10 px-6 py-2.5 rounded-full flex items-center gap-3 shadow-2xl pointer-events-auto ring-1 ring-white/5">
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="text-sm font-black text-white font-display uppercase tracking-widest">
                        BRND Intelligence
                    </span>
                </div>

                <div className="pointer-events-auto">
                    <Button
                        onClick={() => setShowTemplates(!showTemplates)}
                        variant="ghost"
                        size="sm"
                        className="bg-zinc-900/80 backdrop-blur border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs font-mono"
                    >
                        <Zap className="w-3 h-3" />
                        Templates
                        <ChevronDown className={`w-3 h-3 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
                    </Button>

                    {/* Templates Dropdown */}
                    {showTemplates && (
                        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
                            <div className="p-3 border-b border-zinc-800">
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Query Templates</p>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {queryTemplates.map((template) => (
                                    <Button
                                        key={template.id}
                                        onClick={() => handleTemplateSelect(template)}
                                        variant="ghost"
                                        className="w-full justify-start h-auto px-4 py-3 hover:bg-zinc-800 rounded-none border-b border-zinc-800/50 last:border-0"
                                    >
                                        <div className="text-left">
                                            <p className="text-sm text-white font-medium">{template.name}</p>
                                            <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto scroll-smooth">
                <div className="max-w-3xl mx-auto px-4 pt-24 pb-40 min-h-full flex flex-col">
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-20 h-20 bg-zinc-900/50 rounded-3xl flex items-center justify-center mb-8 border border-zinc-800 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] backdrop-blur-sm">
                                <Sparkles className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 font-display text-center tracking-tight">
                                Unlock Insights
                            </h2>
                            <p className="text-zinc-500 font-mono mb-8 text-center max-w-md text-sm leading-relaxed">
                                Ask anything about users, brands, votes, or trends.<br />
                                AI will analyze the database for you.
                            </p>

                            {frequentQueries.length > 0 && (
                                <div className="flex items-center gap-2 mb-4 text-zinc-600">
                                    <History className="w-3 h-3" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest">Consultas frecuentes</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                                {exampleQueries.map((query, i) => (
                                    <Card
                                        key={i}
                                        onClick={() => handleSubmit(query)}
                                        className="text-left px-6 py-5 group cursor-pointer bg-[#212020]/50 border-[#484E55]/50 hover:border-[#484E55] transition-all"
                                    >
                                        <span className="font-mono text-xs text-zinc-400 group-hover:text-white transition-colors block leading-relaxed">
                                            {query}
                                        </span>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {messages.map((message, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {message.role === "assistant" && (
                                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0 mt-1 shadow-lg">
                                            <Bot className="w-4 h-4 text-zinc-400" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-2xl rounded-2xl p-6 shadow-sm ${message.role === "user"
                                            ? "bg-zinc-900 border border-zinc-800 text-white"
                                            : message.isError
                                                ? "bg-red-950/10 border border-red-900/50 text-red-200"
                                                : "bg-transparent px-0 py-0"
                                            }`}
                                    >
                                        <p className={`font-mono text-sm whitespace-pre-wrap leading-relaxed ${message.role === "user" ? "text-zinc-300" : "text-zinc-300"}`}>
                                            {message.content}
                                        </p>

                                        {/* SQL Query oculta - descomentar para debug
                                        {message.sql && (
                                            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-[#050505] shadow-lg">
                                                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-800/50">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                        <span className="text-[10px] text-zinc-500 font-bold font-mono uppercase tracking-widest">SQL Query</span>
                                                    </div>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(message.sql!)}
                                                        className="text-zinc-500 hover:text-white transition-colors p-1.5 hover:bg-zinc-800 rounded-lg"
                                                        title="Copy SQL"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="p-4 overflow-x-auto custom-scrollbar">
                                                    <code className="text-xs text-green-400/90 font-mono whitespace-pre leading-relaxed">
                                                        {message.sql}
                                                    </code>
                                                </div>
                                            </div>
                                        )}
                                        */}

                                        {/* Leaderboard especial */}
                                        {message.visualization?.type === 'leaderboard' && message.data && (
                                            <WeekLeaderboard
                                                data={message.data}
                                                title={message.visualization.title || "BRND Week Leaderboard"}
                                            />
                                        )}

                                        {/* Charts normales */}
                                        {message.visualization && !['table', 'leaderboard'].includes(message.visualization.type) && message.data && (
                                            <div className="mt-6 p-1 rounded-2xl bg-zinc-900/30 border border-zinc-800">
                                                <DynamicChart
                                                    type={message.visualization.type as "bar" | "line" | "pie" | "area"}
                                                    data={message.data}
                                                    xAxisKey={message.visualization.xAxisKey}
                                                    dataKey={message.visualization.dataKey}
                                                    title={message.visualization.title}
                                                />
                                            </div>
                                        )}

                                        {message.data && message.data.length > 0 && (
                                            <div className="mt-8">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-zinc-500" />
                                                        {message.rowCount} Results
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {/* Share Button */}
                                                        <Button
                                                            onClick={() => handleShare(messages.find(m => m.role === "user" && messages.indexOf(m) < i)?.content || "")}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-white bg-zinc-900 hover:bg-zinc-800"
                                                            title="Compartir consulta"
                                                        >
                                                            <Share2 className="w-3 h-3" />
                                                        </Button>
                                                        
                                                        {/* Export Dropdown */}
                                                        <div className="relative">
                                                            <Button
                                                                onClick={() => setShowExportMenu(showExportMenu === message.id ? null : message.id)}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 bg-zinc-900 hover:bg-zinc-800"
                                                            >
                                                                <Download className="w-3 h-3" />
                                                                Export
                                                                <ChevronDown className="w-3 h-3" />
                                                            </Button>
                                                            
                                                            {showExportMenu === message.id && (
                                                                <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                                                                    <Button
                                                                        onClick={() => handleExport(message.id, "csv", message.data!, "")}
                                                                        variant="ghost"
                                                                        className="w-full justify-start rounded-none h-auto px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                                                                    >
                                                                        <Download className="w-3 h-3" />
                                                                        CSV
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => handleExport(message.id, "excel", message.data!, "")}
                                                                        variant="ghost"
                                                                        className="w-full justify-start rounded-none h-auto px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                                                                    >
                                                                        <FileSpreadsheet className="w-3 h-3" />
                                                                        Excel
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => handleExport(message.id, "json", message.data!, "")}
                                                                        variant="ghost"
                                                                        className="w-full justify-start rounded-none h-auto px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                        JSON
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#050505] shadow-lg">
                                                    <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                                        <table className="w-full text-xs font-mono text-left">
                                                            <thead className="bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                                                                <tr>
                                                                    {Object.keys(message.data[0]).map((key) => (
                                                                        <th key={key} className="px-4 py-3 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-800 whitespace-nowrap text-[10px]">
                                                                            {key}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-zinc-800/30">
                                                                {message.data.slice(0, 10).map((row, idx) => (
                                                                    <tr key={idx} className="hover:bg-zinc-900/50 transition-colors group">
                                                                        {Object.values(row).map((val: any, vidx) => (
                                                                            <td key={vidx} className="px-4 py-3 text-zinc-400 group-hover:text-zinc-200 whitespace-nowrap transition-colors">
                                                                                {val?.toString() || <span className="text-zinc-800">-</span>}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {message.data.length > 10 && (
                                                        <div className="px-4 py-3 bg-zinc-900/30 border-t border-zinc-800 text-center">
                                                            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                                                                Showing 10 of {message.data.length} rows
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {message.role === "user" && (
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-white/10">
                                            <User className="w-4 h-4 text-black" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0 shadow-lg">
                                        <Bot className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div className="bg-transparent p-0 flex items-center gap-3 mt-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                                        <span className="text-xs text-zinc-500 font-mono animate-pulse uppercase tracking-widest">Processing Query...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Input Island */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent pt-32 pointer-events-none">
                <div className="max-w-3xl mx-auto pointer-events-auto">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSubmit(input)
                        }}
                        className="relative group isolate"
                    >
                        {/* Gradient Border - Visible on Focus */}
                        <div className="absolute -inset-[2px] bg-gradient-to-r from-[#FFF100] via-[#FF0000] to-[#0C00FF] rounded-[18px] opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10" />

                        {/* Input Container - Must be z-10 to sit above the gradient */}
                        <div className="relative z-10 bg-[#09090B] rounded-2xl flex items-start shadow-2xl shadow-black/80 border border-zinc-800 group-focus-within:border-transparent transition-colors bg-clip-padding">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    // Submit on Cmd/Ctrl+Enter for multiline
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault()
                                        handleSubmit(input)
                                    }
                                }}
                                placeholder="Ask BRND Intelligence... (Cmd+Enter to send)"
                                disabled={loading}
                                rows={1}
                                className="w-full bg-transparent border-none px-6 py-5 pr-16 text-white placeholder:text-zinc-600 focus:ring-0 focus:outline-none font-mono text-sm resize-none overflow-y-auto"
                            />
                            <Button
                                type="submit"
                                disabled={loading || !input.trim()}
                                size="icon"
                                className={`
                                    absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl transition-all duration-300
                                    ${!input.trim() || loading
                                        ? 'bg-zinc-800 text-zinc-500 opacity-50 scale-90 cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-white hover:scale-105 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.5)]'
                                    }
                                `}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </Button>
                        </div>
                    </form>
                    <p className="text-center text-[10px] text-zinc-700 mt-4 font-mono uppercase tracking-widest">
                        Powered by Gemini 2.5 Flash & Prisma
                    </p>
                </div>
            </div>
        </div>
    )
}
