# Ficha de Detalle de Marca - Propuesta de Diseño

## Estructura Propuesta

### 1. Header / Cabecera
- Logo de la marca (imageUrl) - Grande, destacado
- Nombre de la marca (name)
- Estado actual: Badge (Activo/Baneado/Pendiente)
- Ranking actual: `#X` con indicador de tendencia (↑↓)
- Botones de acción: Editar, Banear/Activar, Eliminar

### 2. Información General (Card 1)
- Categoría: (category.name)
- Descripción: (description)
- URL del sitio web: (url)
- Warpcast URL: (warpcastUrl)
- Canal/Perfil: (channel, profile)
- Tipo de consulta: Canal o Perfil (queryType)

### 3. Métricas de Rendimiento (Card 2 - Grid de KPIs)
- Score actual: (score)
- Ranking actual: (currentRanking) con cambio semanal/mensual
- Score semanal: (scoreWeek)
- Ranking semanal: (rankingWeek) con indicador ↑↓
- Score mensual: (scoreMonth)
- Ranking mensual: (rankingMonth)
- Bonus Points: (bonusPoints)
- Seguidores: (followerCount)

### 4. Blockchain & Rewards (Card 3)
- Wallet Address: (walletAddress)
- Total BRND Awarded: (totalBrndAwarded)
- Available BRND: (availableBrnd)
- On-Chain ID: (onChainId)
- On-Chain FID: (onChainFid)
- On-Chain Handle: (onChainHandle)
- Estado de subida a contrato: (isUploadedToContract) - Badge Sí/No
- Metadata Hash: (metadataHash)
- Creado On-Chain: (onChainCreatedAt)

### 5. Actividad Reciente (Card 4 - Tabla)
Tabla de los últimos votos que incluyen esta marca:
- Fecha
- Usuario (con perfil)
- Posición (Brand1, Brand2, Brand3)
- Compartido (Sí/No)
- Recompensa

Datos de: `UserBrandVote` donde `brand1Id = marca.id OR brand2Id = marca.id OR brand3Id = marca.id`

### 6. Tags Asociados (Card 5)
Lista de tags que tiene la marca:
- Extraído de la tabla `BrandTag` → `Tag`

### 7. Timeline / Historial (Card 6)
- Fecha de creación: (createdAt)
- Última actualización: (updatedAt)

### 8. Estadísticas de Estado (Card 7 - Gráfico opcional)
- State Score: (stateScore)
- State Score Week: (stateScoreWeek)
- State Score Month: (stateScoreMonth)

## Preguntas Pendientes

1. ¿Qué es más prioritario mostrar? ¿Las métricas de rendimiento, los datos blockchain, o la actividad reciente?
2. ¿Quieres ver un gráfico de evolución del ranking/score a lo largo del tiempo?
3. ¿Incluimos acciones rápidas como "Ver usuarios que han votado por esta marca", "Asignar BRND tokens", etc.?
4. ¿Diseño en una columna (vertical) o dos columnas (izquierda info general, derecha métricas)?

## Estado
- [ ] Pendiente de definición final
- [ ] Pendiente de implementación

## Ruta Propuesta
`/dashboard/brands/[id]` - Vista de detalle de marca
