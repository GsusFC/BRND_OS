# ✅ REDIS IMPLEMENTATION CHECKLIST

## 📋 FASE 1: SETUP (30 minutos)

### Upstash Account & Database
- [ ] Crear cuenta en [console.upstash.com](https://console.upstash.com)
- [ ] Verificar email
- [ ] Crear nueva Redis database:
  - Name: `brnd-admin-cache`
  - Type: Regional (us-east-1) o Global
  - Eviction: No eviction
  - TLS: Enabled ✅
- [ ] Copiar credenciales REST API:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

### Environment Variables
- [ ] Actualizar `.env.local` con credenciales:
  ```bash
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  ```
- [ ] Verificar `.env.example` actualizado ✅ (ya hecho)
- [ ] Agregar variables en Vercel Dashboard:
  - Production environment
  - Preview environment
  - Development environment
- [ ] Marcar como "Encrypted" en Vercel ✅

### Dependencies
- [ ] Instalar paquete:
  ```bash
  npm install @upstash/redis
  ```
- [ ] Verificar en `package.json`: `@upstash/redis: ^1.34.0`
- [ ] Opcional - Testing:
  ```bash
  npm install -D @upstash/redis-mock
  ```

### Code Base
- [ ] Verificar archivo creado: `src/lib/redis.ts` ✅
- [ ] Verificar archivo creado: `src/lib/cache/types.ts` ✅
- [ ] Crear directorio: `src/__tests__/cache/`

---

## 📋 FASE 2: MIGRACIÓN BRANDS CACHE (2 horas)

### Backup del código actual
- [ ] Crear backup: `src/lib/seasons/enrichment/brands.ts.backup`
- [ ] Commit actual antes de cambios

### Implementación
- [ ] Abrir `src/lib/seasons/enrichment/brands.ts`
- [ ] Importar Redis client:
  ```typescript
  import { redis, CACHE_KEYS, CACHE_TTL, mgetWithFallback } from '@/lib/redis'
  import type { BrandMetadata } from '@/lib/cache/types'
  ```
- [ ] Eliminar variables globales:
  ```typescript
  // ELIMINAR:
  // let brandCache: Map<number, BrandMetadata> | null = null
  // let cacheTimestamp: number = 0
  ```
- [ ] Refactorizar `getBrandsMetadata()`:
  - [ ] Cambiar a usar `mgetWithFallback`
  - [ ] Usar `CACHE_KEYS.brand(id)` para keys
  - [ ] Usar `CACHE_TTL.brand` para TTL
  - [ ] Mantener fallback a snapshot estático
- [ ] Implementar pipeline para batch writes

### Testing
- [ ] Crear `src/__tests__/cache/brands-cache.test.ts`
- [ ] Test: Cache hit cuando existe
- [ ] Test: Cache miss fetchea desde MySQL
- [ ] Test: TTL expira correctamente
- [ ] Test: Fallback a snapshot cuando MySQL falla
- [ ] Test: Batch operations (mget)
- [ ] Ejecutar tests: `npm test brands-cache`

### Validation
- [ ] Iniciar servidor local: `npm run dev`
- [ ] Abrir dashboard: `http://localhost:3000/dashboard`
- [ ] Verificar en Upstash Console:
  - Keys creadas con patrón `brnd:brand:meta:v1:*`
  - TTL configurado en 3600s
- [ ] Verificar logs: "Cache hit" aparece en segunda carga
- [ ] Verificar performance: latencia <50ms

---

## 📋 FASE 3: MIGRACIÓN USERS CACHE (2 horas)

### Implementación
- [ ] Backup: `src/lib/seasons/enrichment/users.ts.backup`
- [ ] Abrir `src/lib/seasons/enrichment/users.ts`
- [ ] Importar Redis client
- [ ] Refactorizar `getUsersMetadata()`:
  - [ ] Usar `mgetWithFallback`
  - [ ] Keys: `CACHE_KEYS.user(fid)`
  - [ ] TTL: `CACHE_TTL.user` (6 horas)
  - [ ] Mantener integración con Turso
  - [ ] Mantener fetch desde Neynar
- [ ] Implementar pipeline para writes

### Testing
- [ ] Crear `src/__tests__/cache/users-cache.test.ts`
- [ ] Test: Cache hit/miss
- [ ] Test: Fetch desde Turso cuando no en Redis
- [ ] Test: Fetch desde Neynar cuando `fetchMissingFromNeynar=true`
- [ ] Test: TTL 6 horas
- [ ] Ejecutar tests: `npm test users-cache`

### Validation
- [ ] Verificar keys en Upstash: `brnd:user:meta:v1:*`
- [ ] TTL: 21600s (6 horas)
- [ ] Logs: Cache hits en requests subsecuentes
- [ ] Performance: <30ms

---

## 📋 FASE 4: MIGRACIÓN DASHBOARD STATS CACHE (1 hora)

### Implementación
- [ ] Abrir `src/app/dashboard/page.tsx`
- [ ] Importar Redis helpers:
  ```typescript
  import { redis, CACHE_KEYS, CACHE_TTL, getWithFallback } from '@/lib/redis'
  ```
- [ ] Eliminar cache global:
  ```typescript
  // ELIMINAR:
  // let dashboardStatsCache: { value: ..., updatedAtMs: number } | null = null
  ```
- [ ] Refactorizar `getDashboardStats()`:
  ```typescript
  async function getDashboardStats() {
    return getWithFallback(
      CACHE_KEYS.dashboardStats(),
      async () => getDashboardStatsFresh(),
      CACHE_TTL.dashboardStats
    )
  }
  ```
- [ ] Similar para `getRecentVotes()`:
  ```typescript
  async function getRecentVotes() {
    return getWithFallback(
      CACHE_KEYS.recentVotes(),
      async () => { /* lógica actual */ },
      CACHE_TTL.recentVotes
    )
  }
  ```

### Testing
- [ ] Test manual: Cargar dashboard 2 veces
- [ ] Verificar en Upstash:
  - `brnd:dashboard:stats:v1`
  - `brnd:dashboard:recent_votes:v1`
- [ ] TTL: 300s (5 minutos)
- [ ] Performance: Dashboard load <1s

---

## 📋 FASE 5: CACHE WARMING & LOCKS (1.5 horas)

### Implementación de Locks
- [ ] Abrir `src/lib/seasons/adapters/indexer-brands.ts`
- [ ] Importar lock helpers:
  ```typescript
  import { withLock } from '@/lib/redis'
  ```
- [ ] Refactorizar `ensureBrandsLeaderboardMaterialized()`:
  ```typescript
  const result = await withLock(
    'leaderboard_refresh_brands',
    () => refreshBrandsLeaderboardMaterialized(nowMs),
    { ttl: 30, waitTime: 5000 }
  )
  ```
- [ ] Eliminar variable global `refreshBrandsLeaderboardPromise`

### Testing
- [ ] Test: Concurrent cache warming (simular 10 requests simultáneos)
- [ ] Test: Solo 1 refresh ejecuta, otros esperan
- [ ] Test: Lock se libera después de completar
- [ ] Test: Timeout si lock no se adquiere en 5s

### Validation
- [ ] Load testing con 100 requests concurrentes
- [ ] Verificar logs: Solo 1 "Refreshing cache" message
- [ ] Verificar en Upstash: Lock key `brnd:lock:leaderboard_refresh_brands` aparece/desaparece
- [ ] No race conditions

---

## 📋 FASE 6: MONITORING & OBSERVABILITY (1 hora)

### Métricas a agregar
- [ ] Crear `src/lib/cache/metrics.ts`:
  ```typescript
  export async function getCacheStats() {
    const info = await redis.info()
    // Parse metrics
    return {
      hits: ...,
      misses: ...,
      hitRate: ...,
      totalKeys: ...,
    }
  }
  ```
- [ ] Agregar logging de cache hit/miss:
  ```typescript
  if (cached) {
    console.log(`[CACHE HIT] ${key}`)
  } else {
    console.log(`[CACHE MISS] ${key}`)
  }
  ```

### Dashboard de métricas (opcional)
- [ ] Crear endpoint: `src/app/api/admin/cache/stats/route.ts`
- [ ] Retornar métricas de Redis
- [ ] Crear página: `src/app/dashboard/cache-stats/page.tsx`
- [ ] Mostrar:
  - Cache hit rate
  - Total keys
  - Memory usage
  - Top keys por size

---

## 📋 FASE 7: TESTING COMPLETO (2 horas)

### Unit Tests
- [ ] Ejecutar todos los tests: `npm test`
- [ ] Coverage >80% para archivos de cache
- [ ] Todos los tests pasan ✅

### Integration Tests
- [ ] Test: Dashboard completo carga correctamente
- [ ] Test: Brands page funciona
- [ ] Test: Users page funciona
- [ ] Test: Analytics funcionan
- [ ] Test: Cache warming no causa errores

### Load Testing
- [ ] Herramienta: k6, Artillery, o similar
- [ ] Escenario: 100 usuarios concurrentes
- [ ] Duración: 5 minutos
- [ ] Verificar:
  - [ ] Response time <500ms (P95)
  - [ ] Error rate <0.1%
  - [ ] Cache hit rate >80%
  - [ ] No memory leaks
  - [ ] Redis connections no se agotan

### Regression Testing
- [ ] Todas las features existentes funcionan
- [ ] No nuevos bugs introducidos
- [ ] Performance igual o mejor que antes

---

## 📋 FASE 8: DEPLOYMENT (2 horas)

### Pre-deployment
- [ ] Code review completo
- [ ] Todos los tests pasan en CI
- [ ] Variables de entorno configuradas en Vercel
- [ ] Documentación actualizada

### Staging
- [ ] Deploy a Preview environment
- [ ] Smoke testing:
  - [ ] Dashboard carga
  - [ ] Cache funciona
  - [ ] Upstash muestra keys
- [ ] Performance testing en staging
- [ ] Verificar métricas correctas

### Production (Canary)
- [ ] Deploy a 10% de usuarios
- [ ] Monitorear por 1 hora:
  - [ ] Error rate
  - [ ] Cache hit rate
  - [ ] Response times
  - [ ] Upstash dashboard
- [ ] Si OK → 50% de usuarios
- [ ] Monitorear 30 minutos
- [ ] Si OK → 100% de usuarios
- [ ] Monitorear 2 horas

### Post-deployment
- [ ] Verificar métricas en producción:
  - [ ] Cache hit rate >80% ✅
  - [ ] Dashboard load <1s ✅
  - [ ] API latencies <200ms ✅
  - [ ] No errores relacionados con Redis
- [ ] Documentar métricas baseline
- [ ] Crear alertas si métricas degradan

---

## 📋 ROLLBACK PLAN (Si algo sale mal)

### Triggers de rollback
- [ ] Cache hit rate <60% después de 1 hora
- [ ] Error rate >1%
- [ ] Latencia aumenta >50%
- [ ] Upstash down/inaccesible

### Procedimiento
1. [ ] Revertir último deploy en Vercel
2. [ ] Verificar que vuelve a versión anterior
3. [ ] Monitorear por 30 minutos
4. [ ] Investigar issue en Redis
5. [ ] Fix y re-deploy

### Fallback temporal
- [ ] Si Redis falla, aplicación debe funcionar con MySQL directo
- [ ] Verificar try/catch en todos los calls a Redis
- [ ] Logs claros cuando falla Redis

---

## ✅ CRITERIOS DE ACEPTACIÓN FINAL

### Performance
- [ ] Cache hit rate >80% en producción (medido durante 24h)
- [ ] Dashboard load time <1s (P75)
- [ ] API /leaderboard <100ms (P95)
- [ ] API /dashboard/stats <200ms (P95)

### Reliability
- [ ] 0 errores relacionados con Redis en 24h
- [ ] Uptime 99.9%+
- [ ] Graceful degradation si Redis falla

### Code Quality
- [ ] Test coverage >80%
- [ ] No warnings en build
- [ ] Code review aprobado
- [ ] Documentación actualizada

### Business Metrics
- [ ] Reducción de 70%+ en queries a MySQL
- [ ] Reducción de 60%+ en calls a Neynar API
- [ ] Costo Upstash <$20/mes

---

## 📊 MÉTRICAS A TRACKEAR (Primera Semana)

### Daily
- [ ] Cache hit rate
- [ ] Total Redis keys
- [ ] Memory usage en Upstash
- [ ] API response times (P50, P95, P99)
- [ ] Error rate

### Weekly
- [ ] Costo de Upstash
- [ ] Reducción en queries MySQL
- [ ] Reducción en calls Neynar
- [ ] User experience metrics (Core Web Vitals)

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### "Cannot connect to Redis"
- [ ] Verificar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`
- [ ] Verificar que están en Vercel Environment Variables
- [ ] Verificar región de Upstash vs Vercel deployment

### "Cache hit rate muy bajo"
- [ ] Verificar TTLs configurados correctamente
- [ ] Verificar keys consistentes (no generadas aleatoriamente)
- [ ] Verificar que pipeline.exec() se está llamando

### "Memory usage alto en Upstash"
- [ ] Revisar TTLs (no dejar keys sin expiración)
- [ ] Implementar eviction policy
- [ ] Usar SCAN + DEL para limpiar keys antiguas

### "Latencia alta"
- [ ] Usar `mget` en vez de múltiples `get`
- [ ] Usar pipeline para batch writes
- [ ] Considerar cambiar de Regional a Global Upstash

---

## 📚 DOCUMENTACIÓN A CREAR

- [ ] `docs/cache/redis-architecture.md` - Explicar estrategia
- [ ] `docs/cache/troubleshooting.md` - Problemas comunes
- [ ] `docs/cache/monitoring.md` - Cómo monitorear
- [ ] Actualizar `README.md` con setup de Redis
- [ ] Actualizar `CHANGELOG.md`

---

**NOTA:** Marcar ✅ cada item cuando se complete. Este checklist está diseñado para ser seguido en orden secuencial.
