// Utilidades de exportación para BRND Intelligence

export interface ExportData {
    question: string
    sql?: string
    data: Record<string, unknown>[]
    summary?: string
    timestamp: number
}

// Exportar a CSV
export function exportToCSV(data: Record<string, unknown>[], filename?: string): void {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(","),
        ...data.map(row => 
            headers.map(h => {
                const val = row[h]
                if (val === null || val === undefined) return ""
                if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
                    return `"${val.replace(/"/g, '""')}"`
                }
                return String(val)
            }).join(",")
        )
    ].join("\n")

    downloadFile(csvContent, filename || `brnd-export-${Date.now()}.csv`, "text/csv")
}

// Exportar a JSON
export function exportToJSON(exportData: ExportData, filename?: string): void {
    const jsonContent = JSON.stringify(exportData, null, 2)
    downloadFile(jsonContent, filename || `brnd-export-${Date.now()}.json`, "application/json")
}

// Exportar a Excel (formato XLSX simplificado como CSV con extensión xlsx para compatibilidad)
export function exportToExcel(data: Record<string, unknown>[], filename?: string): void {
    if (!data || data.length === 0) return

    // Crear contenido TSV (Tab-separated) que Excel abre bien
    const headers = Object.keys(data[0])
    const tsvContent = [
        headers.join("\t"),
        ...data.map(row => 
            headers.map(h => {
                const val = row[h]
                if (val === null || val === undefined) return ""
                return String(val).replace(/\t/g, " ").replace(/\n/g, " ")
            }).join("\t")
        )
    ].join("\n")

    // BOM para UTF-8 en Excel
    const BOM = "\uFEFF"
    downloadFile(BOM + tsvContent, filename || `brnd-export-${Date.now()}.xls`, "application/vnd.ms-excel")
}

// Generar link compartible (codifica la query en base64)
export function generateShareableLink(question: string): string {
    const encoded = btoa(encodeURIComponent(question))
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    return `${baseUrl}/dashboard/intelligence?q=${encoded}`
}

// Decodificar query de link compartido
export function decodeSharedQuery(encoded: string): string | null {
    try {
        return decodeURIComponent(atob(encoded))
    } catch {
        return null
    }
}

// Copiar al portapapeles
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === "undefined" || typeof document === "undefined") {
        return false
    }
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        }
        throw new Error("Clipboard API unavailable")
    } catch {
        // Fallback para navegadores antiguos
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        try {
            document.execCommand("copy")
            return true
        } catch {
            return false
        } finally {
            document.body.removeChild(textarea)
        }
    }
}

// Formatear datos para tabla markdown
export function formatAsMarkdown(data: Record<string, unknown>[]): string {
    if (!data || data.length === 0) return ""

    const headers = Object.keys(data[0])
    const separator = headers.map(() => "---").join(" | ")
    const headerRow = headers.join(" | ")
    const rows = data.map(row => 
        headers.map(h => String(row[h] ?? "-")).join(" | ")
    ).join("\n")

    return `| ${headerRow} |\n| ${separator} |\n${rows.split("\n").map(r => `| ${r} |`).join("\n")}`
}

// Helper para descargar archivo
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
