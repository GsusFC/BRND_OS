"use client"

import { useState, useEffect, useCallback } from "react"
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts"
import { TrendingUp, BarChart3, LineChartIcon, Layers, X, Search, Loader2 } from "lucide-react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Brand {
    id: number
    name: string
    imageUrl: string
    score: number
}

interface BrandEvolutionChartProps {
    className?: string
    initialBrands?: Brand[]
}

type ChartType = "line" | "area" | "bar"
type Granularity = "day" | "week" | "month"

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
    { value: "line", label: "Líneas", icon: <LineChartIcon className="w-4 h-4" /> },
    { value: "area", label: "Área", icon: <Layers className="w-4 h-4" /> },
    { value: "bar", label: "Barras", icon: <BarChart3 className="w-4 h-4" /> },
]

const GRANULARITIES: { value: Granularity; label: string }[] = [
    { value: "day", label: "Diario" },
    { value: "week", label: "Semanal" },
    { value: "month", label: "Mensual" },
]

const COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
]

export function BrandEvolutionChart({ className = "", initialBrands }: BrandEvolutionChartProps) {
    const [brands, setBrands] = useState<Brand[]>(initialBrands || [])
    const [selectedBrands, setSelectedBrands] = useState<Brand[]>([])
    const [chartData, setChartData] = useState<Record<string, string | number>[]>([])
    const [chartType, setChartType] = useState<ChartType>("line")
    const [granularity, setGranularity] = useState<Granularity>("day")
    const [loading, setLoading] = useState(!initialBrands)
    const [searchQuery, setSearchQuery] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)

    // Cargar marcas disponibles (skip if we have initial data)
    useEffect(() => {
        if (initialBrands) {
            setLoading(false)
            return
        }

        const fetchBrands = async () => {
            try {
                const res = await fetch("/api/intelligence/brand-evolution")
                const data = await res.json()
                setBrands(data.brands || [])
            } catch (error) {
                console.error("Error fetching brands:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchBrands()
    }, [initialBrands])

    // Cargar datos cuando cambian las marcas seleccionadas o la granularidad
    const fetchEvolutionData = useCallback(async () => {
        if (selectedBrands.length === 0) {
            setChartData([])
            return
        }

        setLoading(true)
        try {
            const brandIds = selectedBrands.map(b => b.id).join(",")
            const res = await fetch(`/api/intelligence/brand-evolution?brandIds=${brandIds}&granularity=${granularity}`)
            const data = await res.json()
            setChartData(data.data || [])
        } catch (error) {
            console.error("Error fetching evolution data:", error)
        } finally {
            setLoading(false)
        }
    }, [selectedBrands, granularity])

    useEffect(() => {
        fetchEvolutionData()
    }, [fetchEvolutionData])

    const handleAddBrand = (brand: Brand) => {
        if (selectedBrands.length >= 10) {
            return
        }
        if (!selectedBrands.find(b => b.id === brand.id)) {
            setSelectedBrands([...selectedBrands, brand])
        }
        setSearchQuery("")
        setShowDropdown(false)
    }

    const handleRemoveBrand = (brandId: number) => {
        setSelectedBrands(selectedBrands.filter(b => b.id !== brandId))
    }

    const filteredBrands = brands.filter(brand =>
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !selectedBrands.find(b => b.id === brand.id)
    ).slice(0, 20)

    const renderChart = () => {
        if (chartData.length === 0) return null

        const brandNames = selectedBrands.map(b => b.name)

        const commonProps = {
            data: chartData,
            margin: { top: 20, right: 30, left: 20, bottom: 20 },
        }

        const xAxisProps = {
            dataKey: "date",
            tick: { fill: "#71717a", fontSize: 10 },
            tickLine: { stroke: "#27272a" },
            axisLine: { stroke: "#27272a" },
        }

        const yAxisProps = {
            tick: { fill: "#71717a", fontSize: 10 },
            tickLine: { stroke: "#27272a" },
            axisLine: { stroke: "#27272a" },
            tickFormatter: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString(),
        }

        const tooltipProps = {
            contentStyle: {
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "12px",
            },
            labelStyle: { color: "#a1a1aa" },
        }

        switch (chartType) {
            case "area":
                return (
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip {...tooltipProps} />
                        <Legend />
                        {brandNames.map((name, index) => (
                            <Area
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stroke={COLORS[index % COLORS.length]}
                                fill={COLORS[index % COLORS.length]}
                                fillOpacity={0.3}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                )
            case "bar":
                return (
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip {...tooltipProps} />
                        <Legend />
                        {brandNames.map((name, index) => (
                            <Bar
                                key={name}
                                dataKey={name}
                                fill={COLORS[index % COLORS.length]}
                                radius={[4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                )
            case "line":
            default:
                return (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip {...tooltipProps} />
                        <Legend />
                        {brandNames.map((name, index) => (
                            <Line
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                )
        }
    }

    return (
        <Card className={`rounded-xl p-6 bg-[#212020]/50 border-[#484E55]/50 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-zinc-400" />
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Brand Evolution</h3>
                    </div>
                </div>

                {/* Controles */}
                <div className="flex items-center gap-2">
                    {/* Granularidad */}
                    <div className="flex rounded-lg border border-[#484E55] overflow-hidden">
                        {GRANULARITIES.map(g => (
                            <Button
                                key={g.value}
                                onClick={() => setGranularity(g.value)}
                                variant="ghost"
                                size="sm"
                                className={`rounded-none text-xs font-mono ${
                                    granularity === g.value
                                        ? "bg-white text-black hover:bg-white hover:text-black"
                                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                                }`}
                            >
                                {g.label}
                            </Button>
                        ))}
                    </div>

                    {/* Tipo de gráfica */}
                    <div className="flex rounded-lg border border-[#484E55] overflow-hidden">
                        {CHART_TYPES.map(type => (
                            <Button
                                key={type.value}
                                onClick={() => setChartType(type.value)}
                                variant="ghost"
                                size="icon"
                                className={`rounded-none h-8 w-8 ${
                                    chartType === type.value
                                        ? "bg-white text-black hover:bg-white hover:text-black"
                                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                                }`}
                                title={type.label}
                            >
                                {type.icon}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Selector de marcas */}
            <div className="mb-6">
                <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
                    Seleccionar marcas (máx. 10)
                </label>
                
                {/* Search input */}
                <div className="relative">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setShowDropdown(true)
                                }}
                                onFocus={() => setShowDropdown(true)}
                                placeholder="Buscar marca..."
                                className="pl-9"
                            />
                        </div>
                        <span className="text-xs text-zinc-600">{selectedBrands.length}/10</span>
                    </div>

                    {/* Dropdown */}
                    {showDropdown && filteredBrands.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
                            {filteredBrands.map(brand => (
                                <button
                                    key={brand.id}
                                    onClick={() => handleAddBrand(brand)}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                                >
                                    {brand.imageUrl && (
                                        <Image
                                            src={brand.imageUrl}
                                            alt={brand.name}
                                            width={24}
                                            height={24}
                                            className="rounded-full"
                                        />
                                    )}
                                    <span className="text-sm text-white">{brand.name}</span>
                                    <span className="ml-auto text-xs text-zinc-500">{brand.score.toLocaleString()} pts</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected brands chips */}
                {selectedBrands.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {selectedBrands.map((brand, index) => (
                            <div
                                key={brand.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                                style={{
                                    borderColor: COLORS[index % COLORS.length],
                                    backgroundColor: `${COLORS[index % COLORS.length]}20`,
                                }}
                            >
                                {brand.imageUrl && (
                                    <Image
                                        src={brand.imageUrl}
                                        alt={brand.name}
                                        width={16}
                                        height={16}
                                        className="rounded-full"
                                    />
                                )}
                                <span className="text-white text-xs">{brand.name}</span>
                                <Button
                                    onClick={() => handleRemoveBrand(brand.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-zinc-400 hover:text-white p-0"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="h-80 w-full">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                    </div>
                ) : selectedBrands.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                        <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">Selecciona marcas para ver su evolución</p>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                        <p className="text-sm">No hay datos disponibles</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                        {renderChart()}
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
}
