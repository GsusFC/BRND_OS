# PRD: Componentes de Formulario de Marca Unificados

**Versión:** 1.0
**Fecha:** 2026-01-20
**Estado:** Pendiente de Validación
**Relacionado con:** PRD-direct-onchain-brand-flow.md

---

## 0. Actualización: Token Info (2026-01-20)

Se integraron los campos de **Token Info** en todo el PRD.

| Sección | Actualización |
|---------|---------------|
| 3. Arquitectura | Diagrama incluye `TokenInfoSection` |
| 4.1 BrandFormData | Campos `tokenContractAddress` y `tokenTicker` |
| 4.3 Estructura | `TokenInfoSection.tsx` + `useContractValidation.ts` |
| 5.1 BrandFormFields | Renderiza `<TokenInfoSection />` |
| 5.6 TokenInfoSection | Nueva sección colapsable con validación onchain |
| 5.8 useContractValidation | Hook para validar contrato en chain |
| 10. Plan | Pasos añadidos para token |
| 12. Archivos | Lista actualizada |
| 13. Mapeo | Tabla y función incluyen campos token |
| 14. Extensibilidad | Checklist genérico simplificado |

---

## 1. Resumen Ejecutivo

Unificar los formularios de marca en componentes reutilizables siguiendo el patrón **A + C**:
- **A**: Todos los formularios manejan los mismos campos
- **C**: Componentes por sección que se pueden componer según el contexto

Esto permite consistencia de datos con flexibilidad de UX.

---

## 2. Problema Actual

### Código Duplicado

Existen 3 formularios que manejan datos de marca:

| Archivo | Ubicación | Uso |
|---------|-----------|-----|
| `ApplyForm.tsx` | `/apply` | Fundadores aplican |
| `ApplicationsTable.tsx` | Dialog de edición | Admins editan pendientes |
| `UpdateOnchainPanel.tsx` | Panel de actualización | Admins actualizan onchain |

**+ 1 nuevo por crear:**
| `CreateOnchainPanel.tsx` | Nueva pestaña | Admins crean directo |

### Problemas Identificados

1. **12 campos repetidos** en cada formulario
2. **handleInputChange** copiado 3 veces
3. **Validación Zod** duplicada
4. **Toggle channel/profile** implementado 3 veces
5. **Preview de imagen** repetido
6. **Cambios requieren editar 3+ archivos**

---

## 3. Solución Propuesta

### Arquitectura A + C

```
┌─────────────────────────────────────────────────────────────────┐
│                         NIVEL A                                  │
│              BrandFormFields (wrapper completo)                  │
│                                                                  │
│   Uso: <BrandFormFields data={...} onChange={...} />            │
│   Renderiza todas las secciones en orden estándar               │
├─────────────────────────────────────────────────────────────────┤
│                         NIVEL C                                  │
│                  Secciones Componibles                           │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ FarcasterSection │  │ BasicInfoSection │                     │
│  │ - queryType      │  │ - name           │                     │
│  │ - channel        │  │ - description    │                     │
│  │ - profile        │  │ - categoryId     │                     │
│  │ - warpcastUrl    │  │ - ownerFid       │                     │
│  │ - followerCount  │  │ - ownerWallet    │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ WebMediaSection  │  │ WalletSection    │                     │
│  │ - url            │  │ - walletAddress  │                     │
│  │ - imageUrl       │  └──────────────────┘                     │
│  └──────────────────┘                                            │
│                                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │ TokenInfoSection (opcional, colapsable)  │                   │
│  │ - tokenContractAddress                   │                   │
│  │ - tokenTicker                            │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Especificación Técnica

### 4.1 Tipo Compartido: `BrandFormData`

```typescript
// Ubicación: src/types/brand.ts

export interface BrandFormData {
  // Farcaster
  queryType: string          // "0" = channel, "1" = profile
  channel: string
  profile: string
  warpcastUrl: string
  followerCount: string

  // Basic Info
  name: string
  description: string
  categoryId: string
  ownerFid: string
  ownerPrimaryWallet: string

  // Web & Media
  url: string
  imageUrl: string

  // Wallet
  walletAddress: string

  // Token Info (opcional)
  tokenContractAddress: string  // Smart contract del token de la marca
  tokenTicker: string           // Símbolo del token (sin prefijo $)
}

export const EMPTY_BRAND_FORM: BrandFormData = {
  queryType: "0",
  channel: "",
  profile: "",
  warpcastUrl: "",
  followerCount: "",
  name: "",
  description: "",
  categoryId: "",
  ownerFid: "",
  ownerPrimaryWallet: "",
  url: "",
  imageUrl: "",
  walletAddress: "",
  tokenContractAddress: "",
  tokenTicker: "",
}
```

### 4.2 Props Compartidas

```typescript
// Ubicación: src/types/brand.ts

export interface CategoryOption {
  id: number
  name: string
}

export interface BrandFormSectionProps {
  formData: BrandFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  errors?: Partial<Record<keyof BrandFormData, string[]>>
  disabled?: boolean
}

export interface BrandFormFieldsProps extends BrandFormSectionProps {
  categories: CategoryOption[]
  onAutoFill?: () => void
  isAutoFilling?: boolean
}
```

### 4.3 Estructura de Archivos

```
src/
├── types/
│   └── brand.ts                    ← Tipos compartidos
│
├── components/
│   └── brands/
│       └── forms/
│           ├── index.ts            ← Exports públicos
│           ├── BrandFormFields.tsx ← Wrapper completo (Nivel A)
│           ├── FarcasterSection.tsx
│           ├── BasicInfoSection.tsx
│           ├── WebMediaSection.tsx
│           ├── WalletSection.tsx
│           ├── TokenInfoSection.tsx  ← Nueva sección
│           └── ImagePreview.tsx
│
└── hooks/
    ├── useBrandForm.ts             ← Hook de estado
    └── useContractValidation.ts    ← Validar contrato en chain
```

---

## 5. Componentes Detallados

### 5.1 `BrandFormFields` (Nivel A)

```typescript
// Ubicación: src/components/brands/forms/BrandFormFields.tsx

interface BrandFormFieldsProps {
  formData: BrandFormData
  onChange: (e: React.ChangeEvent<...>) => void
  errors?: Partial<Record<keyof BrandFormData, string[]>>
  categories: CategoryOption[]
  disabled?: boolean

  // Auto-fill
  onAutoFill?: () => void
  isAutoFilling?: boolean
}

export function BrandFormFields(props: BrandFormFieldsProps) {
  return (
    <div className="space-y-6">
      <FarcasterSection {...props} />
      <BasicInfoSection {...props} />
      <WebMediaSection {...props} />
      <WalletSection {...props} />
      <TokenInfoSection {...props} />
    </div>
  )
}
```

**Uso:**
```tsx
// Formulario completo con orden estándar
<BrandFormFields
  formData={formData}
  onChange={handleChange}
  errors={state.errors}
  categories={categories}
  onAutoFill={handleAutoFill}
  isAutoFilling={isFetching}
/>
```

### 5.2 `FarcasterSection`

```typescript
// Ubicación: src/components/brands/forms/FarcasterSection.tsx

export function FarcasterSection({
  formData,
  onChange,
  errors,
  disabled,
  onAutoFill,
  isAutoFilling,
}: BrandFormSectionProps & {
  onAutoFill?: () => void
  isAutoFilling?: boolean
}) {
  return (
    <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
      <div className="border-b border-zinc-900 pb-4 mb-6 flex justify-between items-center">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
          Farcaster Details
        </h2>
        {onAutoFill && (
          <AutoFillButton onClick={onAutoFill} isLoading={isAutoFilling} />
        )}
      </div>

      {/* Query Type Toggle */}
      <QueryTypeSelector
        value={formData.queryType}
        onChange={onChange}
        disabled={disabled}
      />

      {/* Channel or Profile Input */}
      {formData.queryType === "0" ? (
        <FormField
          name="channel"
          label="Channel Name"
          value={formData.channel}
          onChange={onChange}
          error={errors?.channel}
          placeholder="e.g. farcaster"
          disabled={disabled}
        />
      ) : (
        <FormField
          name="profile"
          label="Profile Username"
          value={formData.profile}
          onChange={onChange}
          error={errors?.profile}
          placeholder="e.g. dwr"
          disabled={disabled}
        />
      )}

      {/* Farcaster URL */}
      <FormField
        name="warpcastUrl"
        label="Farcaster URL"
        type="url"
        value={formData.warpcastUrl}
        onChange={onChange}
        error={errors?.warpcastUrl}
        placeholder="https://warpcast.com/..."
        disabled={disabled}
      />

      {/* Follower Count */}
      <FormField
        name="followerCount"
        label="Follower Count"
        type="number"
        value={formData.followerCount}
        onChange={onChange}
        error={errors?.followerCount}
        placeholder="0"
        disabled={disabled}
      />
    </div>
  )
}
```

### 5.3 `BasicInfoSection`

```typescript
// Ubicación: src/components/brands/forms/BasicInfoSection.tsx

export function BasicInfoSection({
  formData,
  onChange,
  errors,
  categories,
  disabled,
}: BrandFormSectionProps & { categories: CategoryOption[] }) {
  return (
    <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
      <div className="border-b border-zinc-900 pb-4 mb-6">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
          Basic Information
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Brand Name */}
        <FormField
          name="name"
          label="Brand Name"
          value={formData.name}
          onChange={onChange}
          error={errors?.name}
          required
          className="col-span-2"
          disabled={disabled}
        />

        {/* Category */}
        <SelectField
          name="categoryId"
          label="Category"
          value={formData.categoryId}
          onChange={onChange}
          error={errors?.categoryId}
          options={categories.map(c => ({ value: String(c.id), label: c.name }))}
          required
          disabled={disabled}
        />

        {/* Owner FID */}
        <FormField
          name="ownerFid"
          label="Owner FID"
          type="number"
          value={formData.ownerFid}
          onChange={onChange}
          error={errors?.ownerFid}
          required
          disabled={disabled}
        />

        {/* Owner Wallet */}
        <FormField
          name="ownerPrimaryWallet"
          label="Owner Wallet"
          value={formData.ownerPrimaryWallet}
          onChange={onChange}
          error={errors?.ownerPrimaryWallet}
          placeholder="0x..."
          pattern="^0x[a-fA-F0-9]{40}$"
          required
          className="col-span-2 font-mono"
          disabled={disabled}
        />

        {/* Description */}
        <TextAreaField
          name="description"
          label="Description"
          value={formData.description}
          onChange={onChange}
          error={errors?.description}
          rows={3}
          className="col-span-2"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
```

### 5.4 `WebMediaSection`

```typescript
// Ubicación: src/components/brands/forms/WebMediaSection.tsx

export function WebMediaSection({
  formData,
  onChange,
  errors,
  disabled,
}: BrandFormSectionProps) {
  return (
    <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
      <div className="border-b border-zinc-900 pb-4 mb-6">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
          Web & Media
        </h2>
      </div>

      {/* Website URL */}
      <FormField
        name="url"
        label="Website URL"
        type="url"
        value={formData.url}
        onChange={onChange}
        error={errors?.url}
        placeholder="https://..."
        disabled={disabled}
      />

      {/* Logo URL with Preview */}
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <FormField
            name="imageUrl"
            label="Logo URL"
            type="url"
            value={formData.imageUrl}
            onChange={onChange}
            error={errors?.imageUrl}
            placeholder="https://..."
            disabled={disabled}
          />
        </div>
        <ImagePreview src={formData.imageUrl} alt="Logo preview" />
      </div>
    </div>
  )
}
```

### 5.5 `WalletSection`

```typescript
// Ubicación: src/components/brands/forms/WalletSection.tsx

export function WalletSection({
  formData,
  onChange,
  errors,
  disabled,
  readOnly,
}: BrandFormSectionProps & { readOnly?: boolean }) {
  return (
    <div className="space-y-6 rounded-2xl bg-surface border border-border p-8">
      <div className="border-b border-zinc-900 pb-4 mb-6">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
          Wallet
        </h2>
      </div>

      <FormField
        name="walletAddress"
        label="Wallet Address"
        value={formData.walletAddress}
        onChange={onChange}
        error={errors?.walletAddress}
        placeholder="0x..."
        pattern="^0x[a-fA-F0-9]{40}$"
        required
        readOnly={readOnly}
        className="font-mono"
        disabled={disabled}
      />
      <p className="text-xs text-zinc-600">
        Must be a valid Ethereum address (0x...)
      </p>
    </div>
  )
}
```

### 5.6 `TokenInfoSection`

Sección opcional y colapsable para marcas que tienen token asociado.

```typescript
// Ubicación: src/components/brands/forms/TokenInfoSection.tsx

import { useState } from "react"
import { ChevronDown, ChevronRight, Coins, Check, X, Loader2 } from "lucide-react"
import { useContractValidation } from "@/hooks/useContractValidation"

export function TokenInfoSection({
  formData,
  onChange,
  errors,
  disabled,
}: BrandFormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(
    // Expandir si ya hay datos
    Boolean(formData.tokenContractAddress || formData.tokenTicker)
  )

  const { isValid, isLoading } = useContractValidation(formData.tokenContractAddress)

  return (
    <div className="space-y-4 rounded-2xl bg-surface border border-border p-8">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
            Brand Token Info
          </h2>
          <span className="text-xs text-zinc-600">(Optional)</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {isExpanded && (
        <div className="grid gap-6 pt-4 border-t border-zinc-900 md:grid-cols-2">
          {/* Contract Address con validación */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Contract Address
            </label>
            <div className="relative">
              <input
                name="tokenContractAddress"
                type="text"
                value={formData.tokenContractAddress}
                onChange={onChange}
                placeholder="0x..."
                disabled={disabled}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 pr-10 font-mono text-sm focus:border-zinc-700 focus:outline-none disabled:opacity-50"
              />
              {formData.tokenContractAddress && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                  ) : isValid ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600">
              Smart contract address for the brand token
            </p>
            {errors?.tokenContractAddress && (
              <p className="text-xs text-red-500">{errors.tokenContractAddress[0]}</p>
            )}
          </div>

          {/* Ticker con prefijo $ */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Ticker
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <input
                name="tokenTicker"
                type="text"
                value={formData.tokenTicker}
                onChange={(e) => {
                  // Forzar uppercase
                  const syntheticEvent = {
                    ...e,
                    target: {
                      ...e.target,
                      name: e.target.name,
                      value: e.target.value.toUpperCase(),
                    },
                  }
                  onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
                }}
                placeholder="BRND"
                maxLength={10}
                disabled={disabled}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 pl-8 pr-4 py-3 font-mono text-sm uppercase focus:border-zinc-700 focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-zinc-600">
              Token ticker symbol (without $ prefix)
            </p>
            {errors?.tokenTicker && (
              <p className="text-xs text-red-500">{errors.tokenTicker[0]}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

### 5.7 `ImagePreview`

```typescript
// Ubicación: src/components/brands/forms/ImagePreview.tsx

interface ImagePreviewProps {
  src: string
  alt: string
  size?: number
}

export function ImagePreview({ src, alt, size = 48 }: ImagePreviewProps) {
  const [error, setError] = useState(false)

  return (
    <div
      className="shrink-0 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {src && !error ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="text-zinc-700 text-xs font-mono">IMG</span>
      )}
    </div>
  )
}
```

### 5.8 Hook `useContractValidation`

```typescript
// Ubicación: src/hooks/useContractValidation.ts

import { useEffect, useState } from "react"
import { isAddress } from "viem"
import { usePublicClient } from "wagmi"

/**
 * Valida que una dirección sea un contrato válido en chain
 * Verifica que tenga bytecode (no sea una EOA)
 */
export function useContractValidation(address: string) {
  const [isValid, setIsValid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const client = usePublicClient()

  useEffect(() => {
    // Reset si no hay dirección o formato inválido
    if (!address || !isAddress(address)) {
      setIsValid(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    // Verificar que existe bytecode en esa dirección
    client
      .getBytecode({ address: address as `0x${string}` })
      .then((bytecode) => {
        // Si tiene bytecode y no es "0x", es un contrato
        setIsValid(Boolean(bytecode && bytecode !== "0x"))
      })
      .catch(() => {
        setIsValid(false)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [address, client])

  return { isValid, isLoading }
}
```

---

## 6. Hook `useBrandForm`

```typescript
// Ubicación: src/hooks/useBrandForm.ts

import { useState, useCallback } from "react"
import { BrandFormData, EMPTY_BRAND_FORM } from "@/types/brand"

interface UseBrandFormOptions {
  initialData?: Partial<BrandFormData>
}

export function useBrandForm(options: UseBrandFormOptions = {}) {
  const [formData, setFormData] = useState<BrandFormData>({
    ...EMPTY_BRAND_FORM,
    ...options.initialData,
  })

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target
      setFormData(prev => ({ ...prev, [name]: value }))
    },
    []
  )

  const setField = useCallback(
    <K extends keyof BrandFormData>(field: K, value: BrandFormData[K]) => {
      setFormData(prev => ({ ...prev, [field]: value }))
    },
    []
  )

  const setFields = useCallback(
    (fields: Partial<BrandFormData>) => {
      setFormData(prev => ({ ...prev, ...fields }))
    },
    []
  )

  const reset = useCallback(
    (data?: Partial<BrandFormData>) => {
      setFormData({ ...EMPTY_BRAND_FORM, ...data })
    },
    []
  )

  return {
    formData,
    handleChange,
    setField,
    setFields,
    reset,
  }
}
```

---

## 7. Migración de Formularios Existentes

### 7.1 `ApplyForm.tsx` (Antes)

```tsx
// ~200 líneas de campos repetidos
<div className="space-y-6 rounded-2xl ...">
  <h2>Farcaster Details</h2>
  {/* 50 líneas de inputs */}
</div>
<div className="space-y-6 rounded-2xl ...">
  <h2>Basic Information</h2>
  {/* 80 líneas de inputs */}
</div>
// etc...
```

### 7.1 `ApplyForm.tsx` (Después)

```tsx
import { BrandFormFields } from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"

export function ApplyForm({ categories }: { categories: Category[] }) {
  const { formData, handleChange, setFields } = useBrandForm()
  const [isFetching, setIsFetching] = useState(false)
  const [state, formAction, isPending] = useActionState(applyBrand, initialState)

  const handleAutoFill = async () => {
    setIsFetching(true)
    const result = await fetchFarcasterData(formData.queryType, ...)
    if (result.success) {
      setFields(result.data)
    }
    setIsFetching(false)
  }

  return (
    <form action={formAction}>
      <BrandFormFields
        formData={formData}
        onChange={handleChange}
        errors={state.errors}
        categories={categories}
        onAutoFill={handleAutoFill}
        isAutoFilling={isFetching}
      />
      <SubmitButton isPending={isPending} />
    </form>
  )
}
```

**Reducción: ~200 líneas → ~40 líneas**

### 7.2 `ApplicationsTable.tsx` Dialog (Después)

```tsx
import { BrandFormFields } from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"

function EditDialog({ app, categories, open, onOpenChange }) {
  const { formData, handleChange } = useBrandForm({
    initialData: {
      name: app.name || "",
      description: app.description || "",
      // ... mapear desde app
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          <BrandFormFields
            formData={formData}
            onChange={handleChange}
            errors={state.errors}
            categories={categories}
          />
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 7.3 `CreateOnchainPanel.tsx` (Nuevo - Uso Flexible)

```tsx
import {
  FarcasterSection,
  BasicInfoSection,
  WebMediaSection,
  WalletSection
} from "@/components/brands/forms"
import { useBrandForm } from "@/hooks/useBrandForm"

export function CreateOnchainPanel({ categories, isActive }) {
  const { formData, handleChange, setFields } = useBrandForm()

  return (
    <div className="space-y-6">
      {/* Orden personalizado para admins: datos críticos primero */}
      <BasicInfoSection
        formData={formData}
        onChange={handleChange}
        categories={categories}
      />
      <WalletSection
        formData={formData}
        onChange={handleChange}
      />
      <FarcasterSection
        formData={formData}
        onChange={handleChange}
        onAutoFill={handleAutoFill}
      />
      <WebMediaSection
        formData={formData}
        onChange={handleChange}
      />

      <CreateButton formData={formData} />
    </div>
  )
}
```

---

## 8. Comparativa: Antes vs Después

| Métrica | Antes | Después |
|---------|-------|---------|
| Archivos con campos de form | 3 (+1 nuevo) | 1 (secciones) |
| Líneas de código campos | ~600 | ~200 |
| Lugares para agregar campo | 4 | 1 |
| Consistencia visual | Manual | Automática |
| Testing de campos | 4 archivos | 1 archivo |

---

## 9. Criterios de Aceptación

### Funcionales

- [ ] Tipo `BrandFormData` definido con todos los campos
- [ ] `BrandFormFields` renderiza formulario completo
- [ ] Secciones individuales funcionan de forma independiente
- [ ] `useBrandForm` hook maneja estado correctamente
- [ ] `ApplyForm` migrado a usar nuevos componentes
- [ ] `ApplicationsTable` dialog migrado
- [ ] `UpdateOnchainPanel` migrado
- [ ] `CreateOnchainPanel` usa secciones componibles
- [ ] Errores de validación se muestran correctamente
- [ ] Auto-fill de Farcaster funciona

### No Funcionales

- [ ] Sin regresiones visuales
- [ ] Performance igual o mejor
- [ ] Accesibilidad mantenida (labels, aria)

---

## 10. Plan de Implementación

### Fase 1: Fundamentos
1. Crear `src/types/brand.ts` con tipos
2. Crear `src/hooks/useBrandForm.ts`
3. Crear componentes auxiliares (`FormField`, `SelectField`, `TextAreaField`)

### Fase 2: Secciones
4. Crear `ImagePreview.tsx`
5. Crear `FarcasterSection.tsx`
6. Crear `BasicInfoSection.tsx`
7. Crear `WebMediaSection.tsx`
8. Crear `WalletSection.tsx`
9. Crear `useContractValidation.ts` hook
10. Crear `TokenInfoSection.tsx`
11. Crear `BrandFormFields.tsx` (wrapper)

### Fase 3: Migración
12. Migrar `ApplyForm.tsx`
13. Migrar dialog en `ApplicationsTable.tsx`
14. Migrar `UpdateOnchainPanel.tsx`

### Fase 4: Nuevo Flujo
15. Implementar `CreateOnchainPanel.tsx` usando secciones

---

## 11. Decisiones Validadas

### 11.1 Componentes auxiliares de campo

> **¿Crear `FormField`, `SelectField`, `TextAreaField` como componentes?**
>
> **Decisión: SÍ** - Se crean en `/src/components/ui/` junto al design system existente.
>
> El proyecto ya tiene `input.tsx`, `textarea.tsx`, `select.tsx` básicos pero NO tiene
> componentes field de alto nivel. Los nuevos componentes:
> - `FormField.tsx` - wrapper con label + input + error + hint
> - `SelectField.tsx` - wrapper simplificado sobre Select de Radix
> - `TextAreaField.tsx` - wrapper con label + textarea + error
>
> Se integran con `/dashboard/design-system` para documentación visual.

### 11.2 Ubicación del hook

> **¿`useBrandForm` en `/hooks` o en `/components/brands/forms`?**
>
> **Decisión: `/hooks`** - Sigue la convención actual del proyecto.
> El hook no tiene componentes visuales y puede usarse desde cualquier lugar.

---

## 12. Archivos Afectados

### Crear

```
# Tipos
src/types/brand.ts

# Componentes UI (design system)
src/components/ui/form-field.tsx
src/components/ui/select-field.tsx
src/components/ui/textarea-field.tsx

# Hooks
src/hooks/useBrandForm.ts
src/hooks/useContractValidation.ts

# Secciones de formulario de marca
src/components/brands/forms/index.ts
src/components/brands/forms/BrandFormFields.tsx
src/components/brands/forms/FarcasterSection.tsx
src/components/brands/forms/BasicInfoSection.tsx
src/components/brands/forms/WebMediaSection.tsx
src/components/brands/forms/WalletSection.tsx
src/components/brands/forms/TokenInfoSection.tsx
src/components/brands/forms/ImagePreview.tsx
```

### Modificar

```
# Migrar a nuevos componentes
src/components/brands/ApplyForm.tsx
src/components/dashboard/ApplicationsTable.tsx
src/components/dashboard/UpdateOnchainPanel.tsx

# Agregar nuevos componentes al design system
src/app/dashboard/design-system/page.tsx
```

---

## 13. Integración con Proceso Onchain

### 13.1 Análisis de Alineación

El formulario unificado debe generar datos compatibles con `PrepareMetadataPayload` para el proceso onchain.

**Contrato BRND (`0x6C551239379238926A425826C0572fCDa7485DaE`):**
```solidity
createBrand(handle, metadataHash, fid, walletAddress) → brandId
updateBrand(brandId, newMetadataHash, newFid, newWalletAddress)
```

**Datos onchain directos:** `handle`, `fid`, `walletAddress`
**Datos en IPFS (metadataHash):** El resto de campos

### 13.2 Mapeo BrandFormData → PrepareMetadataPayload

| Campo Payload | Campo Form | Transformación |
|---------------|------------|----------------|
| `name` | `name` | Directo |
| `handle` | `channel` / `profile` | Derivado según `queryType` |
| `fid` | `ownerFid` | `Number()` |
| `walletAddress` | `walletAddress` | Directo |
| `url` | `url` | Directo |
| `warpcastUrl` | `warpcastUrl` | Directo |
| `description` | `description` | Directo |
| `categoryId` | `categoryId` | `Number()` o `null` |
| `followerCount` | `followerCount` | `Number()` o `null` |
| `imageUrl` | `imageUrl` | Directo |
| `profile` | `profile` | Directo |
| `channel` | `channel` | Directo |
| `queryType` | `queryType` | `Number()` |
| `channelOrProfile` | — | Derivado |
| `isEditing` | — | Contexto de operación |
| `brandId` | — | Contexto (solo update) |
| `tokenContractAddress` | `tokenContractAddress` | Directo o `null` |
| `tokenTicker` | `tokenTicker` | Directo o `null` |

### 13.3 Función de Mapeo

```typescript
// Ubicación: src/lib/brand-form-utils.ts

import type { BrandFormData } from "@/types/brand"
import type { PrepareMetadataPayload } from "@/lib/actions/brand-actions"

const normalizeHandle = (value: string) =>
  value.replace(/^[@/]+/, "").trim().toLowerCase()

interface MetadataContext {
  isEditing: boolean
  brandId?: number
}

export function toMetadataPayload(
  formData: BrandFormData,
  context: MetadataContext
): PrepareMetadataPayload {
  const channelOrProfile = formData.queryType === "0"
    ? formData.channel
    : formData.profile
  const handle = normalizeHandle(channelOrProfile)

  return {
    name: formData.name,
    handle,
    fid: Number(formData.ownerFid) || 0,
    walletAddress: formData.walletAddress,
    url: formData.url,
    warpcastUrl: formData.warpcastUrl,
    description: formData.description,
    categoryId: formData.categoryId ? Number(formData.categoryId) : null,
    followerCount: formData.followerCount ? Number(formData.followerCount) : null,
    imageUrl: formData.imageUrl,
    profile: formData.profile,
    channel: formData.channel,
    queryType: Number(formData.queryType),
    channelOrProfile,
    isEditing: context.isEditing,
    brandId: context.brandId,
    // Token Info (opcional)
    tokenContractAddress: formData.tokenContractAddress || null,
    tokenTicker: formData.tokenTicker || null,
  }
}
```

### 13.4 Uso en Componentes

```typescript
// CreateOnchainPanel.tsx (crear nueva marca)
const payload = toMetadataPayload(formData, { isEditing: false })
const result = await prepareBrandMetadata(payload)

// UpdateOnchainPanel.tsx (actualizar marca existente)
const payload = toMetadataPayload(formData, { isEditing: true, brandId: selected.brandId })
const result = await prepareBrandMetadata(payload)

// ApplicationsTable.tsx (aprobar pendiente)
const payload = toMetadataPayload(formData, { isEditing: false })
const result = await prepareBrandMetadata(payload)
```

### 13.5 Validación Pre-Onchain

Antes de llamar a `prepareBrandMetadata`, validar en cliente:

```typescript
// Ubicación: src/lib/brand-form-utils.ts

export function validateForOnchain(formData: BrandFormData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const channelOrProfile = formData.queryType === "0"
    ? formData.channel
    : formData.profile
  const handle = normalizeHandle(channelOrProfile)

  if (!handle) {
    errors.push("Handle is required (channel or profile)")
  }

  if (!formData.ownerFid || Number(formData.ownerFid) <= 0) {
    errors.push("Owner FID is required")
  }

  if (!formData.walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
    errors.push("Valid wallet address is required")
  }

  if (!formData.name) {
    errors.push("Brand name is required")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

### 13.6 Archivos Adicionales

Agregar a lista de archivos a crear:

```
src/lib/brand-form-utils.ts    ← toMetadataPayload + validateForOnchain
```

---

## 14. Guía de Extensibilidad: Añadir Nuevos Campos

Para añadir nuevos campos al formulario en el futuro, seguir este checklist:

### Checklist

| Paso | Archivo | Acción |
|------|---------|--------|
| 1 | `src/types/brand.ts` | Añadir campo a `BrandFormData` y `EMPTY_BRAND_FORM` |
| 2 | `src/lib/validations/brand.ts` | Añadir validación Zod |
| 3 | `src/components/brands/forms/[Section].tsx` | Añadir campo a sección existente o crear nueva |
| 4 | `src/hooks/use[Validation].ts` | Crear hook si requiere validación especial |
| 5 | `src/lib/brand-form-utils.ts` | Añadir al mapeo `toMetadataPayload` |
| 6 | `src/lib/actions/brand-actions.ts` | Añadir a `PrepareMetadataPayload` |

### Ejemplo: Añadir campo simple

```typescript
// 1. src/types/brand.ts
export interface BrandFormData {
  // ...existentes
  newField: string
}

// 2. src/lib/validations/brand.ts
newField: z.string().optional()

// 3. En la sección correspondiente
<FormField
  name="newField"
  label="New Field"
  value={formData.newField}
  onChange={onChange}
/>

// 5. src/lib/brand-form-utils.ts
return {
  // ...existentes
  newField: formData.newField || null,
}
```

### Ejemplo: Campo con validación async (ver TokenInfoSection)

Para campos que requieren validación contra servicios externos (blockchain, APIs), ver la implementación de `TokenInfoSection` (sección 5.6) y `useContractValidation` (sección 5.8) como referencia.

---

**Documento preparado para revisión del equipo.**
