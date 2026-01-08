# Brands: estrategia de sincronización onchain/indexer/MySQL

## Contexto
Si la “fuente de verdad” es el **contrato BRND** (onchain), la dirección correcta suele ser:

- **Contrato (onchain)** -> emite eventos / estado
- **Indexer (Postgres)** -> **lee** la chain y materializa tablas (`brands`, `votes`, etc.)
- **App (Next/MySQL)** -> guarda *offchain* (aplicaciones, drafts, metadata extra, workflow admin), y consulta el indexer para lo “onchain”

Un indexer **no debería** recibir escrituras de la app como “crear una marca”, porque entonces deja de ser un indexer y pasas a tener 2 fuentes de verdad.

---

## Estado actual (según el repo)
- `/apply` + `dashboard create/update` escriben en **MySQL**.
- Existe un **Indexer (Postgres)** y se usa para datos onchain (leaderboards/votos/brands indexadas), pero no hay un flujo completo implementado de:
  - aprobar marca -> ejecutar **tx onchain** -> indexer indexa -> reflejar estado onchain en MySQL.

---

## ¿Es la mejor forma?
Depende de qué signifique “marca” en el producto.

### Opción A (recomendada si el contrato es el registry / source-of-truth)
**MySQL = workflow + metadata** / **Indexer = estado onchain**

#### Qué guardas en MySQL
- aplicación (pending)
- metadata editable (copy, links, imágenes, `categoryId`, etc.)
- estado del workflow (`pending_review`, `approved_pending_tx`, `onchain_confirmed`, `rejected`)
- `txHash`, `chainId`, `onchainBrandId` (si aplica)

#### Qué guardas en Indexer
- la marca **onchain** real (id, wallet, fid/handle si está en contrato, etc.)

#### Flujo propuesto
- `/apply` -> MySQL `pending` (en el repo hoy se representa como `banned: 1`)
- Admin “Approve” -> server action dispara **tx al contrato**
- Indexer indexa el evento -> ya existe la marca onchain
- App **reconcilia** MySQL con indexer (por `txHash` o `onchainBrandId`) y marca como confirmada

**Pros**
- Una sola fuente de verdad para lo onchain
- Auditoría perfecta (indexer)
- Evitas inconsistencias (MySQL dice approved pero onchain no existe)

**Contras**
- Más trabajo: tx + reconciliación

### Opción B (válida si el contrato no es source-of-truth del catálogo)
**MySQL manda** y el contrato/indexer se usa para seasons/rewards/votos.

**Pros**
- Simple
- UX admin directo

**Contras**
- Si querías que el contrato sea registry real, no cumple

---

## Recomendación de implementación (si vamos con Opción A)

### 1) Definir el ID canónico
Necesitamos saber cuál es la identidad de la marca en el contrato:
- ¿Existe `brandId` onchain que emite un evento?
- ¿O la identidad es `fid`?
- ¿O la identidad es `wallet`?

### 2) Añadir vínculo fuerte en MySQL
Campos sugeridos en MySQL (ejemplo conceptual):
- `onchainBrandId` (nullable)
- `onchainTxHash` (nullable)
- `onchainStatus` (`pending`, `submitted`, `confirmed`, `failed`)

### 3) Reconciliación
- Job/endpoint admin que consulta indexer y actualiza MySQL
  - o, en lectura, un “merge” live con indexer.

---

## Preguntas pendientes (para continuar)
1) ¿Qué función/evento del contrato crea una marca? (nombre del evento o ABI fragment)
2) ¿Qué consume el front para el “listado oficial de marcas”: MySQL o indexer?
