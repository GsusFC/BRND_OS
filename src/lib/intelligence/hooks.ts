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

// Helper para cargar mensajes de localStorage
function loadStoredMessages(): Message[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(STORAGE_KEY)
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
        if (isLoaded && messages.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))) // Mantener últimos 50
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
        localStorage.removeItem(STORAGE_KEY)
    }, [])

    return { messages, setMessages, addMessage, clearHistory, isLoaded }
}

// Hook para cache de queries
export function useQueryCache() {
    const [cache, setCache] = useState<Map<string, CachedQuery>>(new Map())

    useEffect(() => {
        const stored = localStorage.getItem(CACHE_KEY)
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
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
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
        name: "🏆 BRND Week Leaderboard",
        description: "Ranking semanal con desglose de votos oro/plata/bronce",
        template: "BRND WEEK LEADERBOARD",
        params: [],
        category: "brands"
    },
    {
        id: "weekly-analysis-post",
        name: "📊 Weekly Analysis Post",
        description: "Genera un post comparando dos rounds del leaderboard",
        template: `WEEKLY LEADERBOARD ANALYSIS: Round {currentRound} vs Round {previousRound}`,
        params: [
            { name: "currentRound", type: "number", placeholder: "Current Round (e.g., 23)" },
            { name: "previousRound", type: "number", placeholder: "Previous Round (e.g., 22)" }
        ],
        category: "trends"
    },
    {
        id: "top-brands",
        name: "Top Marcas",
        description: "Las marcas con más votos",
        template: "Muéstrame las top {limit} marcas por votos totales",
        params: [
            { name: "limit", type: "select", placeholder: "Cantidad", options: ["5", "10", "20", "50"] }
        ],
        category: "brands"
    },
    {
        id: "brand-voters",
        name: "Votantes de Marca",
        description: "Usuarios que votaron por una marca específica",
        template: "¿Qué usuarios votaron por {brand} en {period}?",
        params: [
            { name: "brand", type: "text", placeholder: "Nombre de marca" },
            { name: "period", type: "select", placeholder: "Período", options: ["esta semana", "este mes", "últimos 7 días", "últimos 30 días"] }
        ],
        category: "brands"
    },
    {
        id: "user-activity",
        name: "Actividad de Usuario",
        description: "Historial de votos de un usuario",
        template: "Muéstrame la actividad de votación del usuario {username}",
        params: [
            { name: "username", type: "text", placeholder: "Username" }
        ],
        category: "users"
    },
    {
        id: "daily-votes",
        name: "Votos por Día",
        description: "Tendencia de votos diarios",
        template: "¿Cuántos votos hubo por día en los últimos {days} días?",
        params: [
            { name: "days", type: "select", placeholder: "Días", options: ["7", "14", "30", "60"] }
        ],
        category: "votes"
    },
    {
        id: "category-ranking",
        name: "Ranking por Categoría",
        description: "Top marcas en una categoría",
        template: "Top {limit} marcas en la categoría {category}",
        params: [
            { name: "limit", type: "select", placeholder: "Cantidad", options: ["5", "10", "20"] },
            { name: "category", type: "text", placeholder: "Categoría" }
        ],
        category: "brands"
    },
    {
        id: "growth-analysis",
        name: "Análisis de Crecimiento",
        description: "Marcas con mayor crecimiento",
        template: "¿Qué marcas tuvieron mayor crecimiento en votos en los últimos {days} días?",
        params: [
            { name: "days", type: "select", placeholder: "Días", options: ["7", "14", "30"] }
        ],
        category: "trends"
    },
    {
        id: "top-voters",
        name: "Top Votantes",
        description: "Usuarios más activos",
        template: "¿Quiénes son los {limit} usuarios que más han votado?",
        params: [
            { name: "limit", type: "select", placeholder: "Cantidad", options: ["10", "20", "50", "100"] }
        ],
        category: "users"
    },
    {
        id: "brand-comparison",
        name: "Comparar Marcas",
        description: "Comparativa entre dos marcas",
        template: "Compara los votos de {brand1} vs {brand2} en el último mes",
        params: [
            { name: "brand1", type: "text", placeholder: "Primera marca" },
            { name: "brand2", type: "text", placeholder: "Segunda marca" }
        ],
        category: "brands"
    }
]
