"use client"

import { useState, useEffect, useCallback } from "react"

// Types
export interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    sql?: string
    data?: Record<string, unknown>[]
    summary?: string
    rowCount?: number
    isError?: boolean
    timestamp: number
    visualization?: {
        type: "bar" | "line" | "pie" | "area" | "table" | "leaderboard" | "analysis_post"
        title?: string
        xAxisKey?: string
        dataKey?: string
        description?: string
        allowExport?: boolean
    }
}

export interface QueryTemplate {
    id: string
    name: string
    description: string
    template: string
    params: {
        name: string
        type: "text" | "number" | "date" | "select"
        placeholder: string
        options?: string[]
    }[]
    category: "users" | "brands" | "votes" | "trends"
}

interface CachedQuery {
    question: string
    response: Message
    timestamp: number
    hits: number
}

const STORAGE_KEY = "brnd-intelligence-history"
const CACHE_KEY = "brnd-intelligence-cache"
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

const hasLocalStorage = () =>
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function"

// Helper para cargar mensajes de localStorage
function loadStoredMessages(): Message[] {
    if (!hasLocalStorage()) return []
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
        try {
            return JSON.parse(stored)
        } catch {
            console.warn("Failed to parse stored messages")
        }
    }
    return []
}

// Hook para historial persistente
export function useMessageHistory() {
    const [messages, setMessages] = useState<Message[]>(loadStoredMessages)
    const [isLoaded, setIsLoaded] = useState(false)

    // Cargar estado inicial - patrón válido para hidratación
    useEffect(() => {
        setIsLoaded(true)
    }, [])

    // Guardar en localStorage cuando cambian los mensajes
    useEffect(() => {
        if (isLoaded && messages.length > 0 && hasLocalStorage()) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))) // Mantener últimos 50
        }
    }, [messages, isLoaded])

    const addMessage = useCallback((message: Omit<Message, "id" | "timestamp">) => {
        const newMessage: Message = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        }
        setMessages(prev => [...prev, newMessage])
        return newMessage
    }, [])

    const clearHistory = useCallback(() => {
        setMessages([])
        if (hasLocalStorage()) {
            window.localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    return { messages, setMessages, addMessage, clearHistory, isLoaded }
}

// Hook para cache de queries
export function useQueryCache() {
    const [cache, setCache] = useState<Map<string, CachedQuery>>(new Map())

    useEffect(() => {
        if (!hasLocalStorage()) return
        const stored = window.localStorage.getItem(CACHE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                const map = new Map<string, CachedQuery>(Object.entries(parsed))
                // Limpiar cache expirado
                const now = Date.now()
                map.forEach((value, key) => {
                    if (now - value.timestamp > CACHE_TTL) {
                        map.delete(key)
                    }
                })
                setCache(map)
            } catch {
                console.warn("Failed to parse query cache")
            }
        }
    }, [])

    const normalizeQuestion = (q: string) => q.toLowerCase().trim().replace(/\s+/g, " ")

    const getCached = useCallback((question: string): Message | null => {
        const key = normalizeQuestion(question)
        const cached = cache.get(key)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            // Incrementar hits
            cached.hits++
            return cached.response
        }
        return null
    }, [cache])

    const setCached = useCallback((question: string, response: Message) => {
        const key = normalizeQuestion(question)
        const newCache = new Map(cache)
        newCache.set(key, {
            question,
            response,
            timestamp: Date.now(),
            hits: 1,
        })
        setCache(newCache)
        // Persistir
        const obj = Object.fromEntries(newCache)
        if (hasLocalStorage()) {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
        }
    }, [cache])

    const getFrequentQueries = useCallback((): string[] => {
        return Array.from(cache.values())
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 5)
            .map(c => c.question)
    }, [cache])

    return { getCached, setCached, getFrequentQueries }
}

// Templates de queries predefinidas
export const queryTemplates: QueryTemplate[] = [
    {
        id: "week-leaderboard",
        name: "🏆 Ranking Semanal",
        description: "¿Quién lidera esta semana?",
        template: "BRND WEEK LEADERBOARD",
        params: [],
        category: "brands"
    },
    {
        id: "weekly-analysis-post",
        name: "📊 Análisis Semanal",
        description: "Post de análisis comparando rounds",
        template: `WEEKLY LEADERBOARD ANALYSIS: Round {currentRound} vs Round {previousRound}`,
        params: [
            { name: "currentRound", type: "number", placeholder: "Round actual (ej: 23)" },
            { name: "previousRound", type: "number", placeholder: "Round anterior (ej: 22)" }
        ],
        category: "trends"
    },
    {
        id: "top-brands",
        name: "🔥 Top Marcas",
        description: "Marcas con más puntos all-time",
        template: "¿Cuáles son las top {limit} marcas?",
        params: [
            { name: "limit", type: "select", placeholder: "Cantidad", options: ["5", "10", "20", "50"] }
        ],
        category: "brands"
    },
    {
        id: "brand-search",
        name: "🔍 Buscar Marca",
        description: "¿Cómo va una marca específica?",
        template: "¿Cómo va {brand}?",
        params: [
            { name: "brand", type: "text", placeholder: "Nombre de marca (ej: base)" }
        ],
        category: "brands"
    },
    {
        id: "daily-votes",
        name: "📈 Tendencia de Votos",
        description: "Votos diarios en los últimos días",
        template: "¿Cuántos votos hubo por día en los últimos {days} días?",
        params: [
            { name: "days", type: "select", placeholder: "Días", options: ["7", "14", "30", "60"] }
        ],
        category: "votes"
    },
    {
        id: "top-voters",
        name: "👥 Top Votantes",
        description: "Usuarios más activos",
        template: "¿Quiénes son los {limit} usuarios que más votan?",
        params: [
            { name: "limit", type: "select", placeholder: "Cantidad", options: ["10", "20", "50"] }
        ],
        category: "users"
    },
    {
        id: "power-levels",
        name: "⚡ Power Levels",
        description: "Distribución de niveles de BRND Power",
        template: "¿Cómo están distribuidos los power levels?",
        params: [],
        category: "users"
    },
    {
        id: "top-collectibles",
        name: "🎨 Top Collectibles",
        description: "Collectibles más valiosos",
        template: "¿Cuáles son los collectibles más caros?",
        params: [],
        category: "brands"
    },
    {
        id: "recent-sales",
        name: "💰 Ventas Recientes",
        description: "Últimas ventas de collectibles",
        template: "¿Qué collectibles se vendieron recientemente?",
        params: [],
        category: "brands"
    },
    {
        id: "brand-comparison",
        name: "⚔️ Comparar Marcas",
        description: "Comparativa entre dos marcas",
        template: "Compara {brand1} con {brand2}",
        params: [
            { name: "brand1", type: "text", placeholder: "Primera marca" },
            { name: "brand2", type: "text", placeholder: "Segunda marca" }
        ],
        category: "brands"
    },
    {
        id: "rewards",
        name: "🎁 Rewards",
        description: "¿Quién ha reclamado más rewards?",
        template: "¿Quiénes han reclamado más rewards?",
        params: [],
        category: "users"
    }
]
