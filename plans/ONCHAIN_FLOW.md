# Onchain Brand Flow (Write-side → Indexer)

## Objetivo
Clarificar el flujo completo desde una aplicación hasta onchain, y qué base de datos se usa en cada etapa.

## Flujo
1) **/apply** (write-side)
   - Fuente: Turso/MySQL
   - Acción: el usuario crea/actualiza su brand en estado "pending"

2) **/dashboard/applications** (review/admin)
   - Fuente: Turso/MySQL
   - Acción: admin revisa datos y prepara la metadata

3) **Generación de metadata JSON**
   - Fuente: Turso/MySQL (payload)
   - Acción: se genera JSON, se sube a IPFS

4) **Onchain (create/update brand)**
   - Fuente: contrato onchain
   - Acción: se escribe onchain (hash IPFS + datos core)

5) **Indexer (read-side)**
   - Fuente: Postgres indexer (onchain)
   - Acción: leaderboards, votos, métricas, detalle S2

## Source of truth
- **Write-side (admin)**: Turso/MySQL
- **Read-side onchain**: Indexer (Postgres)

## Vistas principales
- `/apply` → write-side
- `/dashboard/applications` → write-side
- `/dashboard/brands` → indexer
- `/dashboard/brands/[id]` → indexer (+ metadata opcional)
- `/dashboard/users` → indexer
