# BRND Intelligence - AI Analytics Assistant

## Concepto
Sistema de análisis conversacional con IA que permite hacer queries en lenguaje natural a la base de datos y generar assets de marketing automáticamente.

## Tecnología
- **IA**: Gemini 2.0 Flash (Google)
- **Ventajas**: Gratis, rápido, 1M tokens de contexto, excelente con SQL
- **Límites**: 1,500 requests/día (más que suficiente)

---

## PASO 1: Query & Análisis

### Flujo
```
Usuario pregunta → Gemini genera SQL → Valida seguridad → Ejecuta → Formatea resultados
```

### Características
- Chat conversacional con historial
- Queries en lenguaje natural
- Validación de seguridad (solo SELECT)
- Múltiples formatos de respuesta (tabla, gráfico, número)
- Exportación a CSV
- Sugerencias de queries relacionadas

### Ejemplos de Queries
```
"¿Qué usuarios votaron por @floc entre el 1 y 10 de noviembre?"
"¿Cuántos usuarios han votado esta semana?"
"¿Qué marcas están creciendo más rápido?"
"Compara los votos de @base vs @farcaster"
"¿Qué usuarios votaron por @floc pero NO por @base?"
```

### Prompt Base para Gemini
```
Eres un asistente experto en análisis de datos para BRND, una plataforma de votación de marcas.

SCHEMA DE BASE DE DATOS:
{schema_completo}

REGLAS:
1. SOLO queries SELECT (nunca INSERT, UPDATE, DELETE, DROP)
2. Usa alias descriptivos
3. Limita a 1000 filas máximo
4. Usa JOINS cuando sea necesario
5. Formatea fechas en formato legible

PREGUNTA: {user_question}

RESPONDE EN JSON:
{
  "sql": "SELECT...",
  "explanation": "Esta query obtiene...",
  "suggestedVisualization": "table|chart|number"
}
```

---

## PASO 2: Generación de Assets de Marketing

### 1. Reportes Visuales para Marcas
- PDF profesional con gráficos
- KPIs principales (total voters, growth, position breakdown)
- Timeline de votos
- Top engagement days
- Social shares stats
- Botón: "📊 Generar Reporte para la Marca"

### 2. Copy para Redes Sociales
- Genera 3 variantes (Casual, Estadístico, Narrativo)
- Optimizado para Twitter/X
- Incluye emojis y hashtags relevantes
- Botón: "🐦 Generar Post"

### 3. Listados de Usuarios para Engagement
- Exporta audiencias personalizadas
- Incluye: usernames, FIDs, fechas, nivel de engagement
- Casos de uso:
  - Email campaigns
  - Airdrops exclusivos
  - Badge/NFT rewards
  - Mentions en Twitter
- Botón: "📧 Crear Audiencia Personalizada"

### 4. Análisis Competitivo Automático
Gemini detecta automáticamente:
- Co-votación con otras marcas
- Usuarios nuevos vs recurrentes
- Super fans (votan SOLO por esta marca)
- Correlaciones con eventos/lanzamientos

### 5. Dashboard Personalizado para la Marca
- Link compartible temporal (expira en 7 días)
- Gráficos interactivos
- Timeline de votos
- Top voters con avatares
- Comparativa con meses anteriores
- Botón: "🔗 Generar Link Compartible"

---

## Workflow Completo - Ejemplo

**Caso: Enviar reporte a @floc**

1. Pregunta: "¿Qué usuarios votaron por @floc en noviembre?"
2. Gemini analiza → 547 usuarios
3. Click en "📊 Generar Reporte"
4. Gemini genera:
   - PDF profesional con gráficos
   - Lista de top 10 votantes
   - Comparativa con octubre
   - Copy sugerido para redes
5. Envías el PDF a la marca por email
6. Ellos comparten el copy en Twitter
7. Win-win: La marca tiene datos, tú demuestras valor

---

## Estructura de Archivos

```
src/
├── app/
│   └── dashboard/
│       └── intelligence/
│           └── page.tsx          # UI del chat
├── app/api/
│   └── intelligence/
│       ├── query/
│       │   └── route.ts          # Endpoint principal
│       └── schema/
│           └── route.ts          # Endpoint para obtener schema
├── lib/
│   ├── gemini.ts                 # Cliente Gemini
│   └── intelligence/
│       ├── sql-validator.ts      # Validación de SQL
│       ├── query-executor.ts     # Ejecutor seguro
│       └── prompts.ts            # Prompts para Gemini
└── components/
    └── intelligence/
        ├── ChatInterface.tsx
        ├── QueryResult.tsx
        └── ExampleQueries.tsx
```

---

## Seguridad

- Whitelist de comandos SQL: Solo SELECT
- Rate limiting: Máximo X queries por minuto
- Sanitización: Prevenir SQL injection
- Logs: Todas las queries se registran
- Validación antes de ejecutar cualquier query

---

## Tecnología para Paso 2

- **PDFs**: `react-pdf` o `puppeteer`
- **Gráficos**: `Chart.js` o `Recharts`
- **Links compartibles**: URL con JWT temporal
- **Programar tweets**: Integración con Twitter API (opcional)

---

## Dependencias Necesarias

```bash
npm install @google/generative-ai
npm install react-pdf chart.js recharts
```

**Variables de entorno:**
```env
GEMINI_API_KEY="tu-api-key-aqui"
```

---

## Prioridades de Implementación

### Fase 1 (MVP)
- [ ] Setup Gemini client
- [ ] API endpoint `/api/intelligence/query`
- [ ] UI del chat básica
- [ ] Validación de SQL
- [ ] Ejecución de queries
- [ ] Formato de resultados en tabla

### Fase 2 (Assets de Marketing)
- [ ] Generación de reportes PDF
- [ ] Copy para redes sociales
- [ ] Exportación de audiencias
- [ ] Links compartibles

### Fase 3 (Avanzado)
- [ ] Análisis competitivo automático
- [ ] Gráficos interactivos
- [ ] Historial de conversaciones
- [ ] Queries pre-construidas
- [ ] Sugerencias inteligentes

---

## Estado
- [ ] Pendiente de implementación
- Documentación completada
- Arquitectura definida

## Ruta
`/dashboard/intelligence` - AI Analytics Assistant
