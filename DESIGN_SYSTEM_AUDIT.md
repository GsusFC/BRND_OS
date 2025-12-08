# BRND OS - Design System Audit & Plan

## Resumen Ejecutivo

BRND OS tiene una base sólida con tokens CSS definidos y patrones visuales consistentes. Sin embargo, existen oportunidades para unificar componentes, eliminar duplicación y crear un sistema más escalable.

---

## 1. Auditoría de Componentes Existentes

### 1.1 Inventario de Componentes UI

| Categoría | Componente | Ubicación | Reutilizable | Estado |
|-----------|------------|-----------|--------------|--------|
| **UI Base** | Pagination | `/ui/Pagination.tsx` | ✅ Sí | Bueno |
| | Search | `/ui/Search.tsx` | ✅ Sí | Bueno |
| | SortableHeader | `/ui/SortableHeader.tsx` | ✅ Sí | Bueno |
| | CategoryFilter | `/ui/CategoryFilter.tsx` | ✅ Sí | Bueno |
| **Dashboard** | Sidebar | `/dashboard/Sidebar.tsx` | ⚠️ Específico | Bueno |
| | AddWalletForm | `/dashboard/AddWalletForm.tsx` | ⚠️ Específico | Bueno |
| | TokenSettingsForm | `/dashboard/TokenSettingsForm.tsx` | ⚠️ Específico | Bueno |
| | AllowlistTable | `/dashboard/AllowlistTable.tsx` | ⚠️ Específico | Bueno |
| | BrandsTable | `/dashboard/BrandsTable.tsx` | ⚠️ Específico | Bueno |
| | UsersTable | `/dashboard/UsersTable.tsx` | ⚠️ Específico | Bueno |
| | LiveLeaderboard | `/dashboard/LiveLeaderboard.tsx` | ⚠️ Específico | Bueno |
| | DashboardAnalytics | `/dashboard/DashboardAnalytics.tsx` | ⚠️ Específico | Complejo |
| **Intelligence** | DynamicChart | `/intelligence/DynamicChart.tsx` | ✅ Sí | Bueno |
| | WeekLeaderboard | `/intelligence/WeekLeaderboard.tsx` | ✅ Sí | Bueno |
| | BrandEvolutionChart | `/intelligence/BrandEvolutionChart.tsx` | ✅ Sí | Nuevo |
| **Landing** | Header | `/landing/Header.tsx` | ⚠️ Específico | Bueno |
| | StickyBottomBar | `/landing/StickyBottomBar.tsx` | ⚠️ Específico | Bueno |
| | BrndAttributes | `/landing/BrndAttributes.tsx` | ⚠️ Específico | Bueno |
| | PodiumCarouselGSAP | `/landing/PodiumCarouselGSAP.tsx` | ⚠️ Específico | Complejo |

### 1.2 Inconsistencias Detectadas

#### Colores
| Problema | Ejemplos | Impacto |
|----------|----------|---------|
| Variantes de zinc hardcodeadas | `bg-zinc-900/50`, `bg-zinc-900/30`, `border-zinc-800` | Medio |
| Backgrounds inconsistentes | `bg-[#212020]` vs `bg-black` vs `bg-surface` | Alto |
| Bordes mixtos | `border-[#484E55]` vs `border-zinc-800` vs `border-border` | Alto |

#### Tipografía
| Problema | Ejemplos | Impacto |
|----------|----------|---------|
| Tamaños de texto hardcodeados | `text-[10px]`, `text-[24px]`, `text-[32px]` | Medio |
| Font families inconsistentes | `font-druk` vs `font-display`, `font-inter` (no definida) | Alto |
| Tracking variado | `tracking-wider`, `tracking-widest`, `tracking-wide`, `tracking-[0.15em]` | Bajo |

#### Espaciado
| Problema | Ejemplos | Impacto |
|----------|----------|---------|
| Padding inconsistente en cards | `p-6`, `p-4`, `p-5`, `px-4 py-3` | Medio |
| Gaps variados | `gap-2`, `gap-3`, `gap-4` sin sistema | Bajo |

#### Border Radius
| Problema | Ejemplos | Impacto |
|----------|----------|---------|
| Radios múltiples | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` | Medio |
| Valores custom | `rounded-[11px]`, `rounded-[23px]` | Bajo |

### 1.3 Patrones Repetidos que Podrían Abstraerse

#### Patrón: Card Container
```tsx
// Aparece en 15+ componentes
<div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
```

#### Patrón: Section Title
```tsx
// Aparece en 10+ componentes
<h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
```

#### Patrón: Form Label
```tsx
// Aparece en 8+ componentes
<label className="block text-xs font-mono text-zinc-500 mb-2">
```

#### Patrón: Form Input
```tsx
// Aparece en 6+ componentes
<input className="block w-full rounded-lg bg-black border border-zinc-800 py-2 px-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white transition-colors" />
```

#### Patrón: Primary Button
```tsx
// Aparece en 5+ componentes
<button className="w-full rounded-lg bg-white text-black px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-50">
```

#### Patrón: Icon Button
```tsx
// Aparece en 10+ componentes
<button className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
```

#### Patrón: Table Header
```tsx
// Aparece en 4+ tablas
<th className="py-4 px-6 text-left text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
```

---

## 2. Análisis de Tokens de Diseño

### 2.1 Tokens Actuales (extraídos de `globals.css`)

```css
:root {
  /* Base Colors */
  --background: #000000;
  --foreground: #ffffff;

  /* Surface Colors */
  --surface: #09090B;
  --surface-hover: #18181B;

  /* Borders */
  --border: #27272A;
  --border-input: #484E55;

  /* Brand Gradient */
  --brand-gradient: linear-gradient(90deg, #FFF100 0%, #FF0000 33%, #0C00FF 66%, #00FF00 100%);
}
```

### 2.2 Paleta de Colores Propuesta

#### Colores Base
| Token | Valor Actual | Valor Propuesto | Uso |
|-------|--------------|-----------------|-----|
| `--background` | `#000000` | `#000000` | Fondo principal |
| `--foreground` | `#ffffff` | `#ffffff` | Texto principal |

#### Superficies
| Token | Valor Actual | Valor Propuesto | Uso |
|-------|--------------|-----------------|-----|
| `--surface-100` | - | `#09090B` | Cards, contenedores |
| `--surface-200` | - | `#18181B` | Hover states |
| `--surface-300` | - | `#27272A` | Elementos elevados |
| `--surface-alpha-10` | - | `rgba(255,255,255,0.1)` | Overlays |
| `--surface-alpha-30` | - | `rgba(9,9,11,0.3)` | Cards transparentes |
| `--surface-alpha-50` | - | `rgba(9,9,11,0.5)` | Modals |

#### Bordes
| Token | Valor Actual | Valor Propuesto | Uso |
|-------|--------------|-----------------|-----|
| `--border-subtle` | - | `#1F1F23` | Separadores suaves |
| `--border-default` | `#27272A` | `#27272A` | Bordes principales |
| `--border-emphasis` | `#484E55` | `#3F3F46` | Inputs, focus |
| `--border-strong` | - | `#52525B` | Alto contraste |

#### Texto
| Token | Valor Actual | Valor Propuesto | Uso |
|-------|--------------|-----------------|-----|
| `--text-primary` | - | `#FFFFFF` | Títulos, texto principal |
| `--text-secondary` | - | `#A1A1AA` | Texto secundario |
| `--text-tertiary` | - | `#71717A` | Labels, hints |
| `--text-muted` | - | `#52525B` | Placeholders |
| `--text-inverse` | - | `#000000` | Sobre fondos claros |

#### Estados Semánticos
| Token | Valor Propuesto | Uso |
|-------|-----------------|-----|
| `--success` | `#22C55E` | Confirmaciones |
| `--success-subtle` | `rgba(34,197,94,0.1)` | Backgrounds success |
| `--warning` | `#EAB308` | Alertas |
| `--warning-subtle` | `rgba(234,179,8,0.1)` | Backgrounds warning |
| `--error` | `#EF4444` | Errores |
| `--error-subtle` | `rgba(239,68,68,0.1)` | Backgrounds error |
| `--info` | `#3B82F6` | Información |

#### Brand
| Token | Valor Propuesto | Uso |
|-------|-----------------|-----|
| `--brand-yellow` | `#FFF100` | Gradient stop 1 |
| `--brand-red` | `#FF0000` | Gradient stop 2 |
| `--brand-blue` | `#0C00FF` | Gradient stop 3 |
| `--brand-green` | `#00FF00` | Gradient stop 4 |
| `--brand-gradient` | Actual | Gradiente principal |

### 2.3 Escala Tipográfica

| Token | Tamaño | Line Height | Peso | Uso |
|-------|--------|-------------|------|-----|
| `--text-display-xl` | 48px | 1.1 | 900 | Hero títulos |
| `--text-display-lg` | 36px | 1.15 | 900 | Sección títulos |
| `--text-display-md` | 28px | 1.2 | 700 | Subtítulos grandes |
| `--text-heading-lg` | 24px | 1.25 | 700 | H1 |
| `--text-heading-md` | 20px | 1.3 | 600 | H2 |
| `--text-heading-sm` | 16px | 1.4 | 600 | H3 |
| `--text-body-lg` | 18px | 1.5 | 400 | Párrafos grandes |
| `--text-body-md` | 16px | 1.5 | 400 | Párrafos |
| `--text-body-sm` | 14px | 1.5 | 400 | Texto secundario |
| `--text-caption` | 12px | 1.4 | 500 | Captions, labels |
| `--text-overline` | 10px | 1.3 | 700 | Overlines, badges |

#### Familias Tipográficas
| Token | Valor | Uso |
|-------|-------|-----|
| `--font-display` | Druk Wide Medium | Headlines, branding |
| `--font-sans` | Geist Sans | Cuerpo de texto |
| `--font-mono` | Geist Mono | Código, datos, labels |

### 2.4 Sistema de Espaciado

| Token | Valor | Uso |
|-------|-------|-----|
| `--space-0` | 0px | Reset |
| `--space-1` | 4px | Micro gaps |
| `--space-2` | 8px | Tight spacing |
| `--space-3` | 12px | Default gap |
| `--space-4` | 16px | Card padding |
| `--space-5` | 20px | Section gap |
| `--space-6` | 24px | Large padding |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Large sections |
| `--space-12` | 48px | Page sections |
| `--space-16` | 64px | Hero spacing |

### 2.5 Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | 4px | Badges, chips |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards pequeñas |
| `--radius-xl` | 16px | Cards medianas |
| `--radius-2xl` | 24px | Cards grandes, modals |
| `--radius-full` | 9999px | Avatars, pills |

### 2.6 Sombras y Elevaciones

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.5)` | Elevación sutil |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.5)` | Cards |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.5)` | Dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.5)` | Modals |
| `--shadow-glow` | `0 0 20px rgba(255,255,255,0.1)` | Highlight |
| `--shadow-brand` | `0 0 30px rgba(255,0,0,0.2)` | Brand accent |

### 2.7 Breakpoints

| Token | Valor | Uso |
|-------|-------|-----|
| `--breakpoint-sm` | 640px | Mobile landscape |
| `--breakpoint-md` | 768px | Tablet |
| `--breakpoint-lg` | 1024px | Desktop |
| `--breakpoint-xl` | 1280px | Large desktop |
| `--breakpoint-2xl` | 1536px | Wide screens |

---

## 3. Estructura del Design System Propuesto

### 3.1 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                      TEMPLATES                               │
│            (Dashboard Layout, Landing Page)                  │
├─────────────────────────────────────────────────────────────┤
│                      ORGANISMS                               │
│        (Sidebar, DataTable, FormSection, ChartPanel)        │
├─────────────────────────────────────────────────────────────┤
│                      MOLECULES                               │
│     (Card, FormGroup, ButtonGroup, Dropdown, Modal)         │
├─────────────────────────────────────────────────────────────┤
│                       ATOMS                                  │
│  (Button, Input, Badge, Avatar, Icon, Spinner, Tooltip)     │
├─────────────────────────────────────────────────────────────┤
│                 DESIGN TOKENS                                │
│    (Colors, Typography, Spacing, Shadows, Animations)        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Estructura de Archivos Propuesta

```
src/
├── design-system/
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   ├── shadows.css
│   │   └── index.css
│   ├── atoms/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.types.ts
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Icon/
│   │   ├── Spinner/
│   │   └── Tooltip/
│   ├── molecules/
│   │   ├── Card/
│   │   ├── FormGroup/
│   │   ├── ButtonGroup/
│   │   ├── Dropdown/
│   │   ├── Modal/
│   │   ├── Toast/
│   │   └── Tabs/
│   ├── organisms/
│   │   ├── Sidebar/
│   │   ├── DataTable/
│   │   ├── FormSection/
│   │   ├── ChartPanel/
│   │   └── Header/
│   └── index.ts
```

### 3.3 Componentes Atómicos (Atoms)

| Componente | Variantes | Props Principales |
|------------|-----------|-------------------|
| **Button** | `primary`, `secondary`, `ghost`, `danger`, `brand` | `size`, `disabled`, `loading`, `icon` |
| **Input** | `text`, `number`, `search`, `textarea` | `size`, `error`, `disabled`, `prefix`, `suffix` |
| **Badge** | `default`, `success`, `warning`, `error`, `info` | `size`, `dot` |
| **Avatar** | `xs`, `sm`, `md`, `lg`, `xl` | `src`, `fallback`, `status` |
| **Icon** | Wrapper Lucide | `size`, `color` |
| **Spinner** | `sm`, `md`, `lg` | `color` |
| **Tooltip** | Arriba/abajo/izq/der | `content`, `delay` |

### 3.4 Componentes Moleculares (Molecules)

| Componente | Composición | Props Principales |
|------------|-------------|-------------------|
| **Card** | Container + Header + Body + Footer | `variant`, `padding`, `hover` |
| **FormGroup** | Label + Input + Error + Hint | `label`, `error`, `required` |
| **ButtonGroup** | Button[] | `variant`, `size` |
| **Dropdown** | Trigger + Menu + Items | `items`, `onSelect` |
| **Modal** | Overlay + Container + Header + Body + Footer | `open`, `onClose`, `size` |
| **Toast** | Icon + Message + Action | Via Sonner |
| **Tabs** | TabList + TabPanels | `tabs`, `activeTab` |

### 3.5 Componentes Orgánicos (Organisms)

| Componente | Uso |
|------------|-----|
| **Sidebar** | Navegación del dashboard |
| **DataTable** | Tablas con sorting, filtering, pagination |
| **FormSection** | Secciones de formulario con título |
| **ChartPanel** | Contenedor para gráficas con controles |
| **Header** | Header responsive con navegación |

---

## 4. Plan de Implementación

### Fase 1: Fundamentos (1-2 semanas)
**Prioridad: CRÍTICA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| Tokens CSS | 2 días | Crear archivo de tokens unificado |
| Button | 1 día | Componente con todas las variantes |
| Input | 1 día | Componente con validación y estados |
| Badge | 0.5 días | Badges semánticos |
| Card | 1 día | Container reutilizable |
| Documentación inicial | 1 día | README con guía de uso |

### Fase 2: Formularios (1 semana)
**Prioridad: ALTA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| FormGroup | 1 día | Label + Input + Error |
| Select/Dropdown | 1 día | Dropdown accesible |
| Checkbox/Radio | 0.5 días | Controles de selección |
| Migrar AddWalletForm | 0.5 días | Usar nuevos componentes |
| Migrar TokenSettingsForm | 0.5 días | Usar nuevos componentes |

### Fase 3: Tablas (1 semana)
**Prioridad: ALTA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| DataTable | 2 días | Tabla reutilizable con sorting |
| Pagination (refactor) | 0.5 días | Integrar con tokens |
| Migrar AllowlistTable | 1 día | Usar DataTable |
| Migrar BrandsTable | 1 día | Usar DataTable |

### Fase 4: Navegación y Layout (1 semana)
**Prioridad: MEDIA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| Sidebar (refactor) | 1 día | Componentizar nav items |
| Header (refactor) | 1 día | Unificar landing y dashboard |
| Modal | 1 día | Modal accesible |
| Tabs | 0.5 días | Pestañas reutilizables |

### Fase 5: Gráficas y Visualización (1 semana)
**Prioridad: MEDIA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| ChartPanel | 1 día | Contenedor para gráficas |
| Refactor DynamicChart | 1 día | Usar tokens de color |
| Refactor BrandEvolutionChart | 1 día | Integrar con sistema |

### Fase 6: Landing Page (1 semana)
**Prioridad: BAJA**

| Tarea | Esfuerzo | Descripción |
|-------|----------|-------------|
| Migrar componentes landing | 3 días | Usar design system |
| Documentación final | 2 días | Storybook/docs completos |

---

## 5. Entregables y Estimaciones

### 5.1 Tabla de Tokens: Actual vs Propuesto

| Categoría | Estado Actual | Estado Propuesto |
|-----------|---------------|------------------|
| Colores | 6 tokens base | 25+ tokens semánticos |
| Tipografía | 3 fonts definidas | 11 escalas + 3 fonts |
| Espaciado | Sin sistema | 12 tokens |
| Radios | Sin sistema | 6 tokens |
| Sombras | Sin sistema | 6 tokens |
| Breakpoints | Tailwind default | 5 tokens documentados |

### 5.2 Lista Priorizada de Componentes

| # | Componente | Prioridad | Esfuerzo | Impacto |
|---|------------|-----------|----------|---------|
| 1 | **Button** | P0 | 1d | Alto |
| 2 | **Input** | P0 | 1d | Alto |
| 3 | **Card** | P0 | 1d | Alto |
| 4 | **Badge** | P0 | 0.5d | Medio |
| 5 | **FormGroup** | P1 | 1d | Alto |
| 6 | **DataTable** | P1 | 2d | Alto |
| 7 | **Dropdown** | P1 | 1d | Medio |
| 8 | **Modal** | P2 | 1d | Medio |
| 9 | **Tabs** | P2 | 0.5d | Bajo |
| 10 | **ChartPanel** | P2 | 1d | Medio |

### 5.3 Estimación Total por Fase

| Fase | Duración | Componentes | Esfuerzo |
|------|----------|-------------|----------|
| Fase 1: Fundamentos | 1-2 semanas | 5 | 6.5 días |
| Fase 2: Formularios | 1 semana | 4 | 3.5 días |
| Fase 3: Tablas | 1 semana | 4 | 4.5 días |
| Fase 4: Navegación | 1 semana | 4 | 3.5 días |
| Fase 5: Gráficas | 1 semana | 3 | 3 días |
| Fase 6: Landing | 1 semana | - | 5 días |
| **TOTAL** | **6-8 semanas** | **20** | **26 días** |

---

## 6. Estrategia de Migración Gradual

### Principios
1. **No breaking changes**: Nuevos componentes coexisten con los existentes
2. **Migración por página**: Migrar una página completa antes de pasar a la siguiente
3. **Feature flags**: Posibilidad de rollback si hay problemas
4. **Tests**: Cada componente migrado debe pasar tests visuales

### Orden de Migración Recomendado
1. `/dashboard/allowlist` - Página simple, ideal para probar
2. `/dashboard/brands` - Tabla compleja, validar DataTable
3. `/dashboard` - Overview con cards y stats
4. `/dashboard/users` - Similar a brands
5. `/dashboard/intelligence` - Gráficas
6. `/` - Landing page (última por complejidad)

---

## 7. Documentación Necesaria

| Documento | Contenido | Prioridad |
|-----------|-----------|-----------|
| **README.md** | Instalación, uso básico | P0 |
| **TOKENS.md** | Referencia completa de tokens | P0 |
| **COMPONENTS.md** | Catálogo de componentes | P1 |
| **PATTERNS.md** | Patrones de composición | P2 |
| **MIGRATION.md** | Guía de migración | P1 |
| **Storybook** | Playground interactivo | P3 |

---

## 8. Próximos Pasos

1. **Aprobar este documento** con stakeholders
2. **Crear rama `feature/design-system`**
3. **Implementar Fase 1** (tokens + atoms básicos)
4. **Migrar página piloto** (`/dashboard/allowlist`)
5. **Revisar y ajustar** basado en feedback
6. **Continuar con fases restantes**

---

*Documento generado el 8 de Diciembre de 2025*
*Design System Lead: Cascade AI*
