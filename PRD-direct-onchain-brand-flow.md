# PRD: Flujo Directo de Alta Onchain de Marca

**Versión:** 1.0
**Fecha:** 2026-01-20
**Estado:** Pendiente de Validación
**Autor:** Equipo de Desarrollo

---

## 1. Resumen Ejecutivo

Se propone agregar una **tercera pestaña** en `/dashboard/applications` llamada **"Create Onchain"** que permita a los administradores crear marcas directamente onchain en un único flujo: rellenar formulario → firmar → crear en blockchain.

Este flujo elimina la necesidad del proceso de dos pasos actual (aplicación pendiente → aprobación posterior).

---

## 2. Contexto y Problema

### Estado Actual

La sección `/dashboard/applications` tiene dos flujos:

| Pestaña | Función | Flujo |
|---------|---------|-------|
| **Pending Onchain** | Aprobar aplicaciones existentes | DB (banned=1) → Revisar → Firmar → Onchain → DB (banned=0) |
| **Update Onchain** | Actualizar marcas ya onchain | Buscar onchain → Cargar IPFS → Editar → Firmar → Actualizar |

### Problema Identificado

No existe un flujo para que un admin cree una marca **directamente desde cero** sin pasar por el proceso de aplicación pública (`/apply`).

### Flujo Público Actual (`/apply`)

Existe un flujo público que:
1. Usuario rellena formulario
2. Firma con wallet (nonce + signature)
3. Pasa validación de token gate
4. Inserta en DB con `banned = 1`
5. Admin aprueba posteriormente en `/dashboard/applications`

**Decisión requerida:** ¿Se reutiliza este flujo (`/apply`) o se elimina?

---

## 3. Propuesta de Solución

### Opción A: Nueva Pestaña "Create Onchain" (Recomendada)

Agregar una tercera pestaña en `OnchainTabs` que permita:

```
┌─────────────────────────────────────────────────────────────┐
│  [Pending Onchain] [Update Onchain] [Create Onchain]        │
└─────────────────────────────────────────────────────────────┘
```

**Flujo propuesto:**

```
Admin → Rellena Form → Valida Datos → IPFS → Firma Tx → createBrand() → DB (banned=0)
```

### Componentes a Crear/Modificar

#### 3.1 Nuevo Componente: `CreateOnchainPanel.tsx`

```typescript
// Ubicación: src/components/dashboard/CreateOnchainPanel.tsx

interface CreateOnchainPanelProps {
  categories: CategoryOption[]
  isActive: boolean
}
```

**Características:**
- Formulario completo con todos los campos de marca
- Auto-fill desde Farcaster (reusar `fetchFarcasterData`)
- Validación cliente antes de firmar
- Flujo visual de estados: `Validating → IPFS → Signing → Confirming`
- Sin guardar en DB hasta confirmación onchain

#### 3.2 Modificar: `OnchainTabs.tsx`

Agregar tercera pestaña:

```tsx
<TabsList>
  <TabsTrigger value="pending">Pending Onchain</TabsTrigger>
  <TabsTrigger value="update">Update Onchain</TabsTrigger>
  <TabsTrigger value="create">Create Onchain</TabsTrigger>
</TabsList>

<TabsContent value="create">
  <CreateOnchainPanel categories={categories} isActive={activeTab === "create"} />
</TabsContent>
```

#### 3.3 Nueva Server Action: `createBrandDirect`

```typescript
// Ubicación: src/lib/actions/brand-actions.ts

export async function createBrandDirect(payload: CreateBrandPayload): Promise<{
  valid: boolean
  message?: string
  metadataHash?: string
  handle?: string
}>
```

**Diferencias con `applyBrand`:**
- Sin rate limiting (admin ya autenticado)
- Sin firma de wallet usuario (es el admin quien firma la tx)
- Sin token gate check
- Inserta directamente con `banned = 0`
- Solo accesible para admins

---

## 4. Decisión sobre `/apply`

### Decisión: MANTENER `/apply`

**Confirmado:** `/apply` se mantiene como acceso para **fundadores** que luego los admins aprueban en "Pending Onchain".

**Flujo de dos vías:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   FUNDADORES                          ADMINS                     │
│   ──────────                          ──────                     │
│                                                                  │
│   /apply                              /dashboard/applications    │
│      │                                       │                   │
│      ▼                                       ▼                   │
│   Formulario + Firma              ┌─────────────────────┐        │
│      │                            │ Pending Onchain     │        │
│      ▼                            │ (aprobar apps)      │        │
│   DB (banned=1) ──────────────────│                     │        │
│                                   ├─────────────────────┤        │
│                                   │ Update Onchain      │        │
│                                   │ (editar existentes) │        │
│                                   ├─────────────────────┤        │
│                                   │ Create Onchain      │  ◄─────│── NUEVO
│                                   │ (crear directo)     │        │
│                                   └─────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Sin cambios requeridos en `/apply`.**

---

## 5. Especificación Técnica

### 5.1 Esquema de Datos (Sin Cambios)

La tabla `brands` permanece igual:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `banned` | INTEGER | 0 = activa, 1 = pendiente |
| `ownerFid` | INTEGER | FID del dueño |
| `ownerPrimaryWallet` | TEXT | Wallet del dueño |
| `walletAddress` | TEXT | Wallet para gating |
| ... | ... | ... |

### 5.2 Contrato Inteligente (Sin Cambios)

```solidity
// BRND Contract: 0x6C551239379238926A425826C0572fCDa7485DaE
function createBrand(
  string handle,
  string metadataHash,
  uint256 fid,
  address walletAddress
) → uint16 brandId
```

### 5.3 Flujo de Estados UI

```
┌─────────┐    ┌──────┐    ┌─────────┐    ┌───────────┐    ┌──────┐
│  IDLE   │ → │ IPFS │ → │ SIGNING │ → │ CONFIRMING│ → │ DONE │
└─────────┘    └──────┘    └─────────┘    └───────────┘    └──────┘
                                │
                                ↓ (error)
                          ┌─────────┐
                          │  ERROR  │
                          └─────────┘
```

### 5.4 Validaciones Requeridas

**Cliente (antes de firmar):**
- `handle`: no vacío, sin caracteres especiales
- `ownerFid`: número válido > 0
- `walletAddress`: formato 0x válido
- `categoryId`: categoría existente
- `name`: no vacío

**Servidor (prepareBrandMetadata):**
- Validación completa del payload
- Generación de metadataHash (IPFS)
- Verificación de duplicados (handle único)

---

## 6. Wireframe de UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Pending Onchain                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Create New Brand Onchain                                 │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Farcaster Details                    [Auto-Fill ✨]     │    │
│  │  ┌────────────┐  ┌────────────────────────────┐         │    │
│  │  │ ○ Channel  │  │ channel-name               │         │    │
│  │  │ ○ Profile  │  └────────────────────────────┘         │    │
│  │  └────────────┘                                          │    │
│  │                                                          │    │
│  │  Basic Information                                       │    │
│  │  ┌────────────────────────────────────────────┐         │    │
│  │  │ Brand Name *                               │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐             │    │
│  │  │ Category *       │  │ Owner FID *      │             │    │
│  │  └──────────────────┘  └──────────────────┘             │    │
│  │  ┌────────────────────────────────────────────┐         │    │
│  │  │ Owner Wallet *                             │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │  ┌────────────────────────────────────────────┐         │    │
│  │  │ Description                                │         │    │
│  │  │                                            │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │                                                          │    │
│  │  Web & Media                                             │    │
│  │  ┌────────────────────────────────────────────┐         │    │
│  │  │ Website URL                                │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │  ┌────────────────────────────────────────────┐  [IMG]  │    │
│  │  │ Logo URL                                   │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │                                                          │    │
│  │  Wallet                                                  │    │
│  │  ┌────────────────────────────────────────────┐         │    │
│  │  │ Gating Wallet Address *                    │         │    │
│  │  └────────────────────────────────────────────┘         │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  ██████████████████████████████████████████████ │    │    │
│  │  │  ██  🚀 CREATE BRAND ONCHAIN                 ██ │    │    │
│  │  │  ██████████████████████████████████████████████ │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  * CTA destacado: fondo blanco, texto negro, bold       │    │
│  │  * Hover: glow/shadow effect                             │    │
│  │                                                          │    │
│  │  [Validate] → [IPFS] → [Sign] → [Confirm]               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Reutilización de Código

### Componentes a Reutilizar

| Componente/Función | Origen | Uso |
|--------------------|--------|-----|
| `prepareBrandMetadata` | `brand-actions.ts` | Generar metadata y subir a IPFS |
| `fetchFarcasterData` | `farcaster-actions.ts` | Auto-fill desde Farcaster |
| Estado visual de progreso | `ApproveButton` | UI de estados (Validate→IPFS→Sign→Confirm) |
| Campos del formulario | `ApplyForm` | Estructura y validación |
| `useAdminUser` | `hooks/use-admin-user` | Verificación de permisos |

### Nueva Lógica Requerida

| Función | Descripción |
|---------|-------------|
| `createBrandDirect` | Server action sin token gate ni rate limit |
| `CreateOnchainPanel` | Componente de UI con formulario y firma |
| Inserción directa DB | `INSERT` con `banned = 0` tras confirmación tx |

---

## 8. Criterios de Aceptación

### Funcionales

- [ ] Nueva pestaña "Create Onchain" visible en `/dashboard/applications`
- [ ] Formulario con todos los campos necesarios para crear marca
- [ ] Botón "Auto-Fill" funciona con channel/profile de Farcaster
- [ ] Validación de campos antes de permitir firma
- [ ] Flujo visual de estados durante la transacción
- [ ] Marca creada onchain con `createBrand()`
- [ ] Marca insertada en DB con `banned = 0` tras confirmación
- [ ] Solo admins pueden acceder (verificación onchain)

### No Funcionales

- [ ] Tiempo de respuesta < 3s para validaciones cliente
- [ ] Manejo de errores claro y específico
- [ ] UI responsive (mobile friendly)
- [ ] Estados de loading claros durante transacción

---

## 9. Decisiones Validadas

| Pregunta | Decisión |
|----------|----------|
| ¿Se mantiene `/apply`? | **SÍ** - Es el acceso para fundadores, admins aprueban |
| ¿Ubicación del nuevo flujo? | **Tercera pestaña** en `/dashboard/applications` |
| ¿CTA de la pestaña? | **Acción importante** - destacar visualmente |
| ¿Validar handle duplicado? | **SÍ** - Llamada `getBrand(handle)` antes de firmar |
| ¿Persistencia en DB? | **Después de confirmar onchain** - evita inconsistencias |

### Flujo Final Confirmado

```
┌─────────────────────────────────────────────────────────────────┐
│                     CREATE ONCHAIN FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin rellena formulario                                     │
│           │                                                      │
│           ▼                                                      │
│  2. Click "Create Brand Onchain"                                 │
│           │                                                      │
│           ▼                                                      │
│  3. [VALIDATING] Validar campos + getBrand(handle)               │
│           │                                                      │
│           ├──► Handle existe? → ERROR "Handle ya registrado"     │
│           │                                                      │
│           ▼                                                      │
│  4. [IPFS] Subir metadata a IPFS → obtener metadataHash          │
│           │                                                      │
│           ▼                                                      │
│  5. [SIGNING] Admin firma transacción createBrand()              │
│           │                                                      │
│           ▼                                                      │
│  6. [CONFIRMING] waitForTransactionReceipt()                     │
│           │                                                      │
│           ▼                                                      │
│  7. INSERT en DB con banned=0                                    │
│           │                                                      │
│           ▼                                                      │
│  8. [DONE] ✓ Marca creada                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Estimación de Impacto

### Archivos a Crear

```
src/components/dashboard/CreateOnchainPanel.tsx  (~400 líneas)
```

### Archivos a Modificar

```
src/components/dashboard/OnchainTabs.tsx         (+20 líneas)
src/app/dashboard/applications/page.tsx          (+5 líneas, pasar categories)
src/lib/actions/brand-actions.ts                 (+50 líneas, nueva action)
```

### Archivos Sin Cambios

`/apply` se mantiene - no hay archivos a eliminar.

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Handle duplicado onchain | Media | Bajo | Contrato revierte, mostrar error claro |
| Fallo IPFS | Baja | Alto | Retry automático + múltiples gateways |
| Admin no autorizado | Baja | Alto | Verificación `isAdmin` antes de mostrar botón |
| Gas insuficiente | Baja | Medio | Estimación previa + mensaje de error |

---

## 12. Próximos Pasos

1. **Validar este PRD** con el equipo
2. **Responder preguntas** de sección 9
3. **Diseñar UI** detallada (si aplica)
4. **Implementar** `CreateOnchainPanel`
5. **Testing** en testnet
6. **Deploy** a producción

---

## Anexo: Flujo Completo Propuesto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD APPLICATIONS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Pending Onchain │  │ Update Onchain  │  │ Create Onchain  │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │                    │
│           ▼                    ▼                    ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  Ver apps       │  │  Buscar marca   │  │  Formulario     │          │
│  │  pendientes     │  │  onchain        │  │  vacío          │          │
│  │  (banned=1)     │  │                 │  │                 │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │                    │
│           ▼                    ▼                    ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  Editar (opt)   │  │  Cargar IPFS    │  │  Auto-fill FC   │          │
│  │  + Aprobar      │  │  + Editar       │  │  (opcional)     │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │                    │
│           ▼                    ▼                    ▼                    │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    FLUJO COMÚN                               │        │
│  │  Validate → IPFS Upload → Sign Tx → Wait Confirm → DB Update │        │
│  └─────────────────────────────────────────────────────────────┘        │
│           │                    │                    │                    │
│           ▼                    ▼                    ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  createBrand()  │  │  updateBrand()  │  │  createBrand()  │          │
│  │  + banned=0     │  │                 │  │  + INSERT       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**Documento preparado para revisión del equipo.**
