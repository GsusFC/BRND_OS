# PRD: Rediseño UpdateOnchainPanel

**Versión:** 1.0
**Fecha:** 2026-01-21
**Autor:** Design & Engineering Team

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Problemas Actuales](#problemas-actuales)
3. [Objetivos](#objetivos)
4. [Solución Propuesta](#solución-propuesta)
5. [Especificación de Diseño](#especificación-de-diseño)
6. [Sistema de Tabs](#sistema-de-tabs)
7. [Upload de Logo](#upload-de-logo)
8. [Componentes Técnicos](#componentes-técnicos)
9. [Backend & APIs](#backend--apis)
10. [Plan de Implementación](#plan-de-implementación)
11. [Métricas de Éxito](#métricas-de-éxito)

---

## Resumen Ejecutivo

Rediseño completo del componente `UpdateOnchainPanel` para mejorar la UX al actualizar brands onchain. La solución implementa:

- **Layout de dos columnas** (search/results | edit panel)
- **Sistema de tabs** para organizar información y reducir scroll
- **Upload de imágenes** desde local con subida a IPFS
- **Reducción de ~73%** en altura vertical del formulario
- **Mejor navegación** entre brands con keyboard shortcuts

---

## Problemas Actuales

### 1. Información Oculta Hasta la Selección
- El usuario no puede ver información editable sin seleccionar una brand
- No hay preview de datos antes de hacer clic
- El formulario completo está separado en 5 secciones que ocupan mucho espacio vertical

### 2. Scroll Innecesario
- Al seleccionar, el sistema hace scroll automático (`scrollIntoView`)
- El formulario aparece muy abajo, requiriendo scroll adicional
- La lista de resultados queda fuera de vista
- **Altura total del formulario actual: ~1550px**

### 3. Navegación Confusa
- Botones prev/next están en el panel de edición
- No es intuitivo que puedes navegar entre brands
- Los botones están junto al "Close" sin jerarquía visual clara

### 4. Feedback de Estado Fragmentado
- Mensajes de error/éxito al final del formulario
- Stats de carga en diferentes lugares
- Progreso del update mezclado con el botón submit

### 5. Gestión de Logo Limitada
- Solo permite URLs externas
- No hay forma de subir imágenes desde local
- Requiere que el usuario hostee la imagen previamente

### 6. Espacio Vertical Desperdiciado en Forms

#### Padding Excesivo
- Cada sección: `p-8` (32px) de padding
- Spacing interno: `space-y-6` (24px)
- Header borders: `pb-4 mb-6` (40px)
- **Total por sección: ~96px de padding/spacing**

#### Elementos Sin Valor
- Headers grandes con border-bottom (~60px cada uno)
- Labels uppercase con tracking excesivo
- Muchos campos `col-span-2` que podrían compartir fila
- Helper text redundante

#### Estructura de 5 Secciones
```
FarcasterSection     - 5 campos  (~400px altura)
BasicInfoSection     - 5 campos  (~450px altura)
WebMediaSection      - 2 campos  (~250px altura)
WalletSection        - 1 campo   (~200px altura)
TokenInfoSection     - 2 campos  (~250px altura)
──────────────────────────────────────────────
TOTAL: ~1550px de altura vertical
```

---

## Objetivos

1. **Reducir scroll vertical** usando sistema de tabs
2. **Mejorar navegación** entre brands (keyboard + UI)
3. **Simplificar upload de logos** con soporte para archivos locales
4. **Mantener contexto visual** de search results mientras se edita
5. **Reducir altura del formulario en ~73%** (de 1550px a ~400px por tab)

---

## Solución Propuesta

### Layout de Dos Columnas + Sistema de Tabs

```
┌─────────────────────────────────────────────────────────────┐
│ Wallet Status Banner                                        │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                           │
│  SEARCH          │   EDIT PANEL                              │
│  ┌────────────┐  │   ┌─────────────────────────────────┐    │
│  │ Input   🔍 │  │   │ Brand #123 · /handle            │    │
│  └────────────┘  │   │ [← Prev] [Next →] [Close]       │    │
│                  │   └─────────────────────────────────┘    │
│  RESULTS         │                                           │
│  ┌────────────┐  │   TABS                                    │
│  │ Card 1  ✓ │  │   [Farcaster] [Basic] [Media] [Wallet]   │
│  ├────────────┤  │   [Token]                                 │
│  │ Card 2    │  │   ─────────────────────────────────       │
│  ├────────────┤  │                                           │
│  │ Card 3    │  │   [Content del tab activo]                │
│  └────────────┘  │                                           │
│                  │                                           │
│  [Page 1/5]      │                                           │
│  [◄] [►]         │   ─────────────────────────────────       │
│                  │   [Update Onchain] [Status Indicator]     │
│                  │                                           │
└──────────────────┴──────────────────────────────────────────┘
```

### Beneficios
- **73% reducción** en altura del panel de edición
- Search results siempre visibles
- Navegación más rápida entre brands
- Contexto visual constante
- Tabs organizan información lógicamente

---

## Especificación de Diseño

### Responsive Behavior

#### Desktop (≥1024px)
```css
.container {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
}
```

#### Tablet (768px - 1023px)
```css
.container {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1rem;
}
```

#### Mobile (<768px)
```css
.container {
  display: flex;
  flex-direction: column;
}

/* Edit panel como modal/overlay cuando hay selection */
.edit-panel {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.95);
  overflow-y: auto;
}
```

### Estimación de Altura

#### Antes (Sistema Actual)
```
- Wallet Banner: 80px
- Search: 120px
- Results Grid: 400px
- Edit Panel (todas las secciones visibles): 1550px
- Update Button + Status: 150px
─────────────────
TOTAL: ~2300px (requiere mucho scroll)
```

#### Después (Sistema de Tabs)
```
- Wallet Banner: 80px
- Left Column (Search + Results): Scroll independiente
- Right Column:
  - Header: 60px
  - Tabs: 50px
  - Tab Content (máximo): 400px
  - Update Button + Status: 100px
─────────────────
TOTAL Edit Panel: ~610px (sin scroll en mayoría de casos)
```

**Reducción: ~73% menos altura en el panel de edición**

---

## Sistema de Tabs

### Tabs Definidos

#### Tab 1: Farcaster
```typescript
{
  id: 'farcaster',
  label: 'Farcaster',
  icon: 'MessageSquare',
  fields: [
    { name: 'queryType', label: 'Type', type: 'select', required: true },
    { name: 'channel', label: 'Channel', conditional: queryType === '0' },
    { name: 'profile', label: 'Profile', conditional: queryType === '1' },
    { name: 'warpcastUrl', label: 'Farcaster URL', type: 'url' },
    { name: 'followerCount', label: 'Followers', type: 'number' },
  ]
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Type *                                          │
│ [Channel ▼]                                     │
│                                                 │
│ Channel Name                                    │
│ [farcaster_______________________________]     │
│                                                 │
│ Farcaster URL                                   │
│ [https://warpcast.com/~/channel/farcaster___]  │
│                                                 │
│ Follower Count                                  │
│ [1000________]                                  │
└─────────────────────────────────────────────────┘
```

#### Tab 2: Basic Info
```typescript
{
  id: 'basic',
  label: 'Basic',
  icon: 'Info',
  fields: [
    { name: 'name', label: 'Brand Name', required: true },
    { name: 'categoryId', label: 'Category', type: 'select', required: true },
    { name: 'ownerFid', label: 'Owner FID', type: 'number', required: true },
    { name: 'ownerPrimaryWallet', label: 'Owner Wallet', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ]
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Brand Name *                                    │
│ [My Brand____________________________]         │
│                                                 │
│ Category *          Owner FID *                 │
│ [AI ▼]              [12345_______]             │
│                                                 │
│ Owner Wallet *                                  │
│ [0x1234567890abcdef____________________]       │
│                                                 │
│ Description                                     │
│ [                                              │
│  Multi-line description...                      │
│                                              ]  │
└─────────────────────────────────────────────────┘
```

#### Tab 3: Media
```typescript
{
  id: 'media',
  label: 'Media',
  icon: 'Image',
  fields: [
    { name: 'url', label: 'Website', type: 'url' },
    { name: 'imageUrl', label: 'Logo', type: 'logo-upload' }, // NEW: Upload support
  ]
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Website                                         │
│ [https://mybrand.com__________________]        │
│                                                 │
│ Logo                                            │
│ [URL] [Upload] ← Toggle buttons                │
│                                                 │
│ ┌─────────────────────────────────────────┐    │
│ │ 📤 Drop image here or click to browse  │    │
│ │    PNG, JPG, WebP up to 5MB            │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ [Preview if image exists]                       │
│                                                 │
│ ℹ️  Recommended: 512x512px square              │
└─────────────────────────────────────────────────┘
```

#### Tab 4: Wallet
```typescript
{
  id: 'wallet',
  label: 'Wallet',
  icon: 'Wallet',
  fields: [
    { name: 'walletAddress', label: 'Wallet Address', required: true },
  ]
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Wallet Address                                  │
│ [0x1234567890abcdef____________________]       │
│                                                 │
│ ℹ️  Must be a valid Ethereum address           │
└─────────────────────────────────────────────────┘
```

#### Tab 5: Token
```typescript
{
  id: 'token',
  label: 'Token',
  icon: 'Coins',
  optional: true,
  fields: [
    { name: 'tokenContractAddress', label: 'Contract Address' },
    { name: 'tokenTicker', label: 'Ticker' },
  ]
}
```

**Layout (NO accordion, campos normales):**
```
┌─────────────────────────────────────────────────┐
│ 💡 Optional token information                   │
│                                                 │
│ Contract Address                                │
│ [0x9876543210fedcba____________________] ✓     │
│                                                 │
│ Ticker                                          │
│ [$BRND______]                                  │
│                                                 │
│ ℹ️  Token ticker symbol (max 10 chars)         │
└─────────────────────────────────────────────────┘
```

### Validación Visual en Tabs

#### Indicadores de Estado
```typescript
// Red dot: Hay errores en este tab
<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />

// Green checkmark: Tab completo y válido
<Check className="h-3 w-3 text-emerald-500" />

// Gray dot: Tab tiene valores pero puede tener campos opcionales vacíos
<span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
```

#### Navegación Inteligente
Al hacer submit, si hay errores:
1. Cambiar automáticamente al primer tab con errores
2. Scroll al primer campo con error
3. Highlight visual del campo

---

## Upload de Logo

### Feature: Logo con URL o Upload Opcional

**Ubicación:** Tab Media - Campo "Logo"

**Funcionalidad:**
- Dos modos: URL externa o Upload desde local
- Drag & drop support
- Preview antes de upload
- Compresión automática (max 512x512px, 1MB)
- Upload opcional a servicio externo (Cloudflare Images o URL existente)
- Validación de tipo y tamaño

### Diseño del Campo

```
┌─────────────────────────────────────────────────┐
│ Logo                                            │
│ ┌─────────────────────────────────────────┐    │
│ │  [URL] [Upload]  ← Mode switcher        │    │
│ │                                         │    │
│ │  [Área de preview/upload]               │    │
│ │  ┌───────────────────────────────┐      │    │
│ │  │  [Current Logo Preview]       │      │    │
│ │  │  or                            │      │    │
│ │  │  📤 Drag & drop image here    │      │    │
│ │  │     or click to browse         │      │    │
│ │  └───────────────────────────────┘      │    │
│ │                                         │    │
│ │  [https://existing-url.com/logo.png]   │    │
│ │  or                                     │    │
│ │  📁 logo-new.png (125 KB) [Remove]     │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ ℹ️  Recommended: 512x512px, PNG or JPG        │
└─────────────────────────────────────────────────┘
```

### Estados de la UI

#### 1. Empty State (sin logo)
```
┌─────────────────────────────────────┐
│ 📤                                   │
│ Drop image here or click to browse  │
│ PNG, JPG, WebP up to 5MB            │
└─────────────────────────────────────┘
```

#### 2. Uploading State
```
┌─────────────────────────────────────┐
│ ⏳ (spinning)                        │
│ Uploading to IPFS...                │
│ Compressing and uploading...        │
└─────────────────────────────────────┘
```

#### 3. Success State (con preview)
```
┌─────────────────────────────────────┐
│ [Preview    ] logo-new.png          │
│ [Image 64px ] 125 KB          [×]   │
└─────────────────────────────────────┘
```

#### 4. Error State
```
┌─────────────────────────────────────┐
│ ⚠️  Failed to upload                 │
│ File too large. Max 5MB             │
│ [Try Again]                          │
└─────────────────────────────────────┘
```

### Validaciones

```typescript
const validateImageFile = (file: File): string | null => {
  // Type validation
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Please use PNG, JPG, or WebP'
  }

  // Size validation
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return 'File too large. Maximum size is 5MB'
  }

  return null
}
```

---

## Componentes Técnicos

### 1. TabNavigation Component

```typescript
interface Tab {
  id: string
  label: string
  icon: LucideIcon
  hasErrors?: boolean
  hasValues?: boolean
  optional?: boolean
}

function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  validationState
}: TabNavigationProps) {
  return (
    <div className="flex gap-1 border-b border-zinc-800">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative",
            activeTab === tab.id
              ? "text-white border-b-2 border-white -mb-px"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <tab.icon className="h-4 w-4" />
          <span>{tab.label}</span>
          {tab.optional && (
            <span className="text-[10px] text-zinc-600">(optional)</span>
          )}
          {tab.hasErrors && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      ))}
    </div>
  )
}
```

### 2. TabPanel Component

```typescript
function TabPanel({
  id,
  activeTab,
  children
}: TabPanelProps) {
  if (id !== activeTab) return null

  return (
    <div className="py-6 animate-in fade-in-0 duration-200">
      {children}
    </div>
  )
}
```

### 3. EditPanelHeader Component

```typescript
function EditPanelHeader({
  brand,
  onNavigate,
  onClose,
  hasPrev,
  hasNext
}: EditPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">
          Brand #{brand.id}
        </h2>
        <span className="text-sm text-zinc-500">·</span>
        <span className="text-sm text-zinc-400">{brand.handle}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onNavigate('prev')}
          disabled={!hasPrev}
          aria-label="Previous brand"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onNavigate('next')}
          disabled={!hasNext}
          aria-label="Next brand"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  )
}
```

### 4. LogoUploadField Component

```typescript
interface LogoUploadFieldProps {
  value: string // Current URL or file reference
  onChange: (value: string) => void
  onFileUpload: (file: File) => Promise<string> // Returns IPFS hash or URL
  disabled?: boolean
  error?: string
}

type UploadMode = 'url' | 'file'

function LogoUploadField({
  value,
  onChange,
  onFileUpload,
  disabled,
  error
}: LogoUploadFieldProps) {
  const [mode, setMode] = useState<UploadMode>('url')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    // Validate file
    const validationError = validateImageFile(file)
    if (validationError) {
      // Show error
      return
    }

    try {
      setIsUploading(true)

      // Compress image
      const compressedFile = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 512,
      })

      // Generate preview
      const previewUrl = URL.createObjectURL(compressedFile)
      setPreview(previewUrl)
      setUploadedFile(compressedFile)

      // Upload to IPFS
      const ipfsUrl = await onFileUpload(compressedFile)
      onChange(ipfsUrl)

    } catch (error) {
      console.error('Upload error:', error)
      // Show error toast
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setUploadedFile(null)
    setPreview(null)
    onChange('')
  }

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
        Logo
      </label>

      {/* Mode Switcher */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'url' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setMode('url')}
        >
          <Link2 className="h-3 w-3" />
          URL
        </Button>
        <Button
          type="button"
          variant={mode === 'file' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setMode('file')}
        >
          <Upload className="h-3 w-3" />
          Upload
        </Button>
      </div>

      {/* URL Mode */}
      {mode === 'url' && (
        <Input
          name="imageUrl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
      )}

      {/* Upload Mode */}
      {mode === 'file' && (
        <LogoDropzone
          onFileSelect={handleFileSelect}
          preview={preview}
          uploadedFile={uploadedFile}
          isUploading={isUploading}
          disabled={disabled}
        />
      )}

      {/* Preview */}
      {(value || preview) && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-black/40">
          <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-zinc-900">
            <Image
              src={preview || value}
              alt="Logo preview"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {uploadedFile?.name || 'Current logo'}
            </p>
            <p className="text-[10px] text-zinc-500">
              {uploadedFile
                ? `${(uploadedFile.size / 1024).toFixed(1)} KB`
                : 'From URL'
              }
            </p>
          </div>
          {uploadedFile && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
```

### 5. LogoDropzone Component

```typescript
function LogoDropzone({
  onFileSelect,
  preview,
  uploadedFile,
  isUploading,
  disabled
}: LogoDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-colors",
        isDragOver
          ? "border-white bg-white/5"
          : "border-zinc-800 hover:border-zinc-700",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileInput}
        disabled={disabled || isUploading}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />

      <div className="flex flex-col items-center justify-center py-12 px-4">
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 text-zinc-500 animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Uploading to IPFS...</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-white mb-1">
              Drop image here or click to browse
            </p>
            <p className="text-xs text-zinc-500">
              PNG, JPG, WebP up to 5MB
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

### 6. Tab Content Components

Convertir cada section existente a formato de tab:

```typescript
// FarcasterTabContent.tsx
export function FarcasterTabContent({
  formData,
  onChange,
  errors,
  disabled,
  onAutoFill,
  isAutoFilling,
}: TabContentProps) {
  return (
    <div className="space-y-4">
      {/* Sin wrapper de bg-surface border p-8 */}
      {/* Sin header con border-bottom */}
      {/* Campos directamente */}
      <FormField name="queryType" label="Type" required />
      <FormField name="channel" label="Channel" />
      {/* ... */}
    </div>
  )
}

// BasicInfoTabContent.tsx
// MediaTabContent.tsx (incluye LogoUploadField)
// WalletTabContent.tsx
// TokenTabContent.tsx (sin accordion)
```

---

## Backend & APIs

### 1. Upload Logo API

**Endpoint:** `POST /api/admin/upload/logo`

```typescript
// app/api/admin/upload/logo/route.ts

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validaciones
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use PNG, JPG, or WebP' },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Max 5MB' },
        { status: 400 }
      )
    }

    // Upload a Cloudflare Images
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_KEY}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      imageUrl: data?.result?.variants?.[0] ?? null,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// Cloudflare Images is handled directly in the route above.
```

### 2. Environment Variables

```bash
# .env.local
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_IMAGES_API_KEY=your_images_api_key
```

### 3. Integration en UpdateOnchainPanel

```typescript
<LogoUploadField
  value={formData.imageUrl}
  onChange={(value) => {
    setFormData(prev => ({ ...prev, imageUrl: value }))
  }}
  onFileUpload={async (file) => {
    // Upload to Cloudflare Images
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/admin/upload/logo', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error)
    }

    // Retornar URL final para guardar en metadata
    return data.imageUrl
  }}
  disabled={!selected || status !== "idle"}
/>
```

---

## Mejoras Adicionales

### 1. Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selected) return

    // Cmd/Ctrl + Arrow Left/Right para navegar tabs
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
      navigateToPrevTab()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
      navigateToNextTab()
    }

    // Arrow Up/Down para navegar brands
    if (e.key === 'ArrowUp') {
      onNavigate('prev')
    }
    if (e.key === 'ArrowDown') {
      onNavigate('next')
    }

    // Escape para cerrar
    if (e.key === 'Escape') {
      setSelected(null)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [selected])
```

### 2. Auto-save Draft

```typescript
// Guardar draft cada 2 segundos
useEffect(() => {
  if (!selected) return

  const timer = setTimeout(() => {
    localStorage.setItem(
      `brand-draft-${selected.id}`,
      JSON.stringify(formData)
    )
  }, 2000)

  return () => clearTimeout(timer)
}, [formData, selected])

// Recuperar draft al seleccionar
useEffect(() => {
  if (!selected) return

  const draft = localStorage.getItem(`brand-draft-${selected.id}`)
  if (draft) {
    try {
      const parsed = JSON.parse(draft)
      // Mostrar opción de restaurar
      setHasDraft(true)
      setDraftData(parsed)
    } catch {
      // Ignore invalid draft
    }
  }
}, [selected])
```

### 3. Quick Preview en Brand Card

```typescript
<BrandCard selected={selected?.id === brand.id}>
  <div className="flex gap-3">
    <Avatar src={cardMeta[brand.id]?.imageUrl} />
    <div className="flex-1 min-w-0">
      <p className="font-bold text-sm truncate">
        {cardMeta[brand.id]?.name || brand.handle}
      </p>
      <p className="text-xs text-zinc-500">
        #{brand.id} · {brand.handle}
      </p>
      <div className="flex gap-1 mt-1">
        {formData.tokenContractAddress && (
          <Badge variant="outline" size="xs">Token</Badge>
        )}
        {formData.categoryId && (
          <Badge variant="outline" size="xs">
            {getCategoryName(formData.categoryId)}
          </Badge>
        )}
      </div>
    </div>
  </div>
</BrandCard>
```

---

## Plan de Implementación

### Fase 1: Componentes Base (Día 1)
- [ ] Crear `TabNavigation` component
- [ ] Crear `TabPanel` component
- [ ] Crear `EditPanelHeader` component
- [ ] Setup tab state management
- [ ] Crear estructura de dos columnas

**Deliverable:** Layout básico funcionando con tabs vacíos

### Fase 2: Tab Content Components (Día 2)
- [ ] Refactor `FarcasterSection` → `FarcasterTabContent`
- [ ] Refactor `BasicInfoSection` → `BasicInfoTabContent`
- [ ] Refactor `WebMediaSection` → `MediaTabContent`
- [ ] Refactor `WalletSection` → `WalletTabContent`
- [ ] Refactor `TokenInfoSection` → `TokenTabContent` (sin accordion)

**Deliverable:** Todos los tabs con contenido funcionando

### Fase 3: Logo Upload (Día 3)
- [ ] Crear `LogoUploadField` component
- [ ] Crear `LogoDropzone` component
- [ ] Implementar compresión de imágenes (browser-image-compression)
- [ ] Crear API endpoint `/api/admin/upload/logo`
- [ ] Configurar Cloudflare Images (o permitir URL externa)
- [ ] Integrar en `MediaTabContent`

**Deliverable:** Upload de logos funcionando con IPFS

### Fase 4: Integration & Polish (Día 4)
- [ ] Integrar tabs en `UpdateOnchainPanel`
- [ ] Validación visual en tabs (error indicators)
- [ ] Keyboard shortcuts
- [ ] Auto-save draft
- [ ] Loading states
- [ ] Error handling & toasts

**Deliverable:** Feature completa funcionando

### Fase 5: Responsive & Testing (Día 5)
- [ ] Responsive mobile (modal overlay)
- [ ] Testing en diferentes tamaños de pantalla
- [ ] Testing de upload (diferentes tipos de archivo)
- [ ] Testing de validaciones
- [ ] Performance testing (carga de brands)

**Deliverable:** Feature lista para producción

---

## Dependencies

```json
{
  "dependencies": {
    "browser-image-compression": "^2.0.2"
  }
}
```

---

## Testing Checklist

### Layout & Navigation
- [ ] Dos columnas en desktop funcionan correctamente
- [ ] Search panel scroll independiente
- [ ] Edit panel se muestra al seleccionar brand
- [ ] Navegación prev/next entre brands funciona
- [ ] Botón close cierra el edit panel
- [ ] Mobile: edit panel como overlay/modal

### Tabs
- [ ] Click en tab cambia contenido
- [ ] Tab activo tiene estilo correcto
- [ ] Indicadores de error en tabs funcionan
- [ ] Indicadores de valores completados funcionan
- [ ] Keyboard shortcuts para navegar tabs
- [ ] Animación de fade-in al cambiar tabs

### Upload de Logo
- [ ] Upload PNG file
- [ ] Upload JPG file
- [ ] Upload WebP file
- [ ] Reject invalid file types (GIF, SVG, etc.)
- [ ] Reject files > 5MB
- [ ] Preview local file antes de upload
- [ ] Upload a IPFS successfully
- [ ] Switch entre URL y Upload modes
- [ ] Remove uploaded file
- [ ] Loading state durante upload
- [ ] Error messages se muestran
- [ ] Mobile: tap to upload funciona
- [ ] Desktop: drag & drop funciona

### Form Validation
- [ ] Required fields se validan
- [ ] Error messages se muestran inline
- [ ] Submit con errores navega a primer tab con error
- [ ] Tab con errores muestra red dot
- [ ] Validación de wallet address
- [ ] Validación de token contract

### Auto-save
- [ ] Draft se guarda cada 2 segundos
- [ ] Draft se recupera al volver a seleccionar brand
- [ ] Opción de restaurar draft se muestra
- [ ] Draft se limpia después de submit exitoso

### Performance
- [ ] No lag al cambiar tabs
- [ ] Preview de imágenes carga rápido
- [ ] Lista de brands no se re-renderiza innecesariamente
- [ ] Upload de imagen no bloquea UI

---

## Métricas de Éxito

### UX Metrics
- **Reducción de scroll:** 73% menos altura en edit panel
- **Tiempo de navegación:** <2 segundos para navegar entre brands
- **Clicks para editar:** 1 click (vs 3+ en sistema actual)

### Technical Metrics
- **Upload success rate:** >95% de uploads exitosos a IPFS
- **Page load time:** <2s para cargar lista de brands
- **Tab switch time:** <100ms para cambiar de tab

### User Satisfaction
- **Task completion rate:** >90% de edits completados sin errores
- **Error rate:** <5% de submits con errores de validación
- **Feedback positivo:** Al menos 80% de usuarios prefieren nuevo sistema

---

## Riesgos y Mitigaciones

### Riesgo 1: IPFS Upload Failures
**Impacto:** Alto
**Probabilidad:** Media
**Mitigación:**
- Implementar retry logic (3 intentos)
- Fallback a múltiples gateways IPFS
- Permitir continuar con URL si upload falla

### Riesgo 2: Compresión de Imágenes Degrada Calidad
**Impacto:** Medio
**Probabilidad:** Media
**Mitigación:**
- Usar compresión inteligente (mantener calidad visual)
- Mostrar preview antes de comprimir
- Permitir ajustar nivel de compresión

### Riesgo 3: Mobile UX con Overlay
**Impacto:** Medio
**Probabilidad:** Baja
**Mitigación:**
- Testing exhaustivo en dispositivos móviles
- Asegurar que overlay sea scrollable
- Back button cierra overlay

### Riesgo 4: Performance con Muchos Brands
**Impacto:** Medio
**Probabilidad:** Media
**Mitigación:**
- Paginación en lista de brands
- Virtualized list si es necesario
- Lazy loading de previews

---

## Apéndice

### A. Wireframes Completos

Ver sección [Especificación de Diseño](#especificación-de-diseño)

### B. API Contracts

Ver sección [Backend & APIs](#backend--apis)

### C. Component Hierarchy

```
UpdateOnchainPanel
├── WalletStatusBanner
└── TwoColumnLayout
    ├── SearchAndResults (Left Column)
    │   ├── SearchBar
    │   ├── ResultsGrid
    │   │   └── BrandCard[]
    │   └── Pagination
    └── EditPanel (Right Column, conditional)
        ├── EditPanelHeader
        ├── TabNavigation
        ├── TabPanels
        │   ├── FarcasterTabContent
        │   ├── BasicInfoTabContent
        │   ├── MediaTabContent
        │   │   ├── WebsiteField
        │   │   └── LogoUploadField
        │   │       ├── ModeSwitcher
        │   │       ├── URLInput (conditional)
        │   │       ├── LogoDropzone (conditional)
        │   │       └── LogoPreview (conditional)
        │   ├── WalletTabContent
        │   └── TokenTabContent
        └── UpdateActions
            ├── UpdateButton
            └── StatusIndicator
```

---

**Fin del PRD**
