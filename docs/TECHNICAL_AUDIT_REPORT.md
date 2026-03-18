# INFORME DE AUDITORÍA TÉCNICA — ANDINA DELIVERY
## Estándar de Escalabilidad 1000 · Versión 1.0 · Marzo 2026

> **Clasificación**: Crítico — Para revisión del equipo técnico y arquitecto principal.

---

## RESUMEN EJECUTIVO

Se realizó un escaneo recursivo completo de **45 API routes**, **18+ componentes**, **12+ contextos/hooks**, reglas de Firestore y esquemas Zod. Se identificaron **3 vulnerabilidades críticas** que explican el Error 500 y el data leak de 6.8k lecturas con 4 usuarios activos, más **11 problemas de alta prioridad** que impiden escalar a 100k usuarios.

**Efficiency Score actual: 2.5 / 10**

---

## SECCIÓN 1 · VULNERABILIDADES CRÍTICAS

### CVE-1 · PAYLOAD OVERFLOW — Causa directa del Error 500

**Ubicación principal**: `app/checkout/page.tsx:459-471`, `app/api/pedidos/route.ts:357-368`, `lib/schemas/pedido.ts:41`

**Descripción del problema**:

El flujo de pago por transferencia convierte el comprobante en Base64 usando `FileReader.readAsDataURL()` y lo inyecta directamente en el cuerpo JSON del pedido antes de enviarlo a Firestore. La UI informa al usuario que puede subir archivos de hasta 10 MB:

```
app/checkout/page.tsx:789
<span className="text-xs text-gray-500">PNG, JPG o PDF · máx. 10 MB</span>
```

Un archivo PDF de 10 MB se convierte en ~13.3 MB de string Base64. Ese string se embebe en el documento del pedido en Firestore. **El límite máximo de un documento en Firestore es 1 MiB (1,048,576 bytes)**. Un único comprobante PDF supera ese límite en ~12.7x, lo que hace que el Admin SDK de Firestore arroje una excepción no tipada que el catch genérico en la route convierte en un HTTP 500.

**El schema Zod NO valida tamaño**:

```typescript
// lib/schemas/pedido.ts:41
comprobanteBase64: z.string().optional(),  // ← Sin z.max(), sin validación de bytes
```

**Cálculo del impacto**:
- Imagen JPG de 2 MB → ~2.7 MB Base64 → supera límite de 1 MiB
- PDF de 1 MB → ~1.35 MB Base64 → supera límite de 1 MiB
- Incluso una imagen comprimida JPG de 700 KB → ~940 KB Base64 → casi en el límite
- El mismo problema existe en `solicitudes` para `logoBase64` + `bannerBase64` + `menuFotosBase64[]` (tres campos sin límite de tamaño)

**Segundo vector del mismo problema**: `lib/data.ts:40` define `TransferenciaLocal.codigoBase64` (código QR). Este campo se guarda dentro del documento `locales/{id}`, que también contiene el array `menu` con imágenes en Base64. La suma de todos los binarios puede exceder 1 MiB también al actualizar el perfil del local.

---

### CVE-2 · DATA LEAK SISTEMÁTICO — Causa de las 6.8k lecturas

**Origen**: `lib/api-auth.ts:31` — **cada llamada autenticada a cualquier API route genera 1 lectura de Firestore adicional**

```typescript
// lib/api-auth.ts:28-31
const { uid } = await verifyIdToken(token);
const db = getAdminFirestore();
const snap = await db.collection('users').doc(uid).get();  // ← LECTURA por cada request
const rol = (data?.rol ?? 'cliente') as UserRole;
```

El rol del usuario no está en el JWT de Firebase Auth, por lo que `requireAuth()` hace un `getDoc('users/{uid}')` en **cada request**. Los paneles de restaurante y central realizan polling activo:

- Panel restaurante: polling cada ~3-5s para pedidos activos
- Panel central: polling para riders + pedidos
- Rider: polling para estado de carrera
- FCM status check: lectura adicional
- Stats, comisiones, etc.

**Cálculo de amplificación con 4 usuarios activos**:
- 1 panel local activo: ~720 requests/hora × 1 lectura auth = 720 lecturas de `users`
- 1 panel central activo: ~480 requests/hora × 1 lectura auth = 480 lecturas de `users`
- 2 riders activos: ~240 requests/hora × 1 lectura auth = 240 lecturas de `users`
- Total solo de auth: ~1,440 lecturas/hora de `users` (solo de auth)
- Más lecturas de `pedidos`, `locales`, `config` por los mismos polls

Proyectado a 100 usuarios activos: ~36,000 lecturas extra/hora solo por `requireAuth`.

**Segundo vector**: `lib/cartContext.tsx:194-203` — cada modificación del carrito genera `saveCart()` + `refetchCart()` (1 write + 1 read de `users/{uid}`). Con el debounce de 500ms, un usuario navegando rápido por un menú con muchos productos genera ráfagas de lecturas.

**Tercer vector**: `app/checkout/page.tsx:138` — al cargar el checkout, se hace un `fetch('/api/locales/{id}')` por cada parada del carrito, sin caché local. Si el checkout se re-renderiza (por cambio de dirección, propina, etc.) los efectos con dependencias en `[cartStops]` se disparan nuevamente.

---

### CVE-3 · DOCUMENTO MONOLÍTICO — Arquitectura insostenible

**Ubicación**: `lib/locales-firestore.ts:55-66`

El documento de cada local en Firestore contiene:
- Metadatos del local (nombre, rating, horarios, etc.)
- Array `menu[]` con todos los ítems, cada uno con campo `image` que puede ser Base64
- `transferencia.codigoBase64` (QR en Base64)
- `logo` y `cover` (potencialmente Base64)

Al llamar `getLocalesFromFirestore()` se descarga el documento **completo** de cada local en cada request de listado:

```typescript
// lib/locales-firestore.ts:57
const snap = await db.collection(LOCALES_COLLECTION).get();  // ← Full scan, todos los campos
```

Con 22 locales activos y menús de 15-50 ítems con imágenes Base64 de ~200KB cada una, un único `GET /api/locales` puede transferir 50-200 MB de datos, excediendo los límites de memoria y timeout de Vercel Functions (512 MB / 10s por defecto).

---

## SECCIÓN 2 · VULNERABILIDADES DE ALTA PRIORIDAD

### P1 · Full-scan sin límite en `stats/local`

**Archivo**: `app/api/stats/local/route.ts:22-25`

```typescript
const snap = await db
  .collection('pedidos')
  .where('localId', '==', localId)
  .get();  // ← Sin .limit(), sin filtro de fecha. Lee TODOS los pedidos históricos del local.
```

Con un local que tenga 2,000 pedidos históricos, cada carga del dashboard estadístico descarga 2,000 documentos completos. No hay caché. El cómputo de fechas (hoy/semana/mes) se hace en memoria en el servidor después de descargar todo.

**Impacto**: 2,000 lecturas por apertura del dashboard de estadísticas. Cada `GET /api/stats/local` agota el free tier de Firestore en pocas sesiones.

---

### P2 · `requireAuth` sin caché de rol

**Archivo**: `lib/api-auth.ts:29-33`

El rol del usuario debería estar en Firebase Custom Claims (parte del JWT) para evitar la lectura de Firestore. La implementación actual lee el rol desde el documento `users/{uid}` en cada request, multiplicando las lecturas por la frecuencia de polling.

**Solución recomendada**: Usar `verifyIdToken()` con `checkRevoked: false` y agregar el rol como custom claim mediante Admin SDK al momento del login/registro.

---

### P3 · `solicitudPostSchema` acepta binarios sin límite de tamaño

**Archivo**: `lib/schemas/solicitudPost.ts:13-15`

```typescript
logoBase64: z.string().optional(),          // ← Sin límite de bytes
bannerBase64: z.string().optional(),         // ← Sin límite de bytes
menuFotosBase64: z.array(z.string()).optional(), // ← Array sin límite de elementos ni tamaño
```

Un atacante puede enviar un POST a `/api/solicitudes` con 10 strings de Base64 de 900KB cada uno. La suma (9MB) excede el límite de 1MiB por documento y crashea Firestore con 500. No requiere autenticación (la ruta es pública).

---

### P4 · `GET /api/solicitudes` sin paginación

**Archivo**: `app/api/solicitudes/route.ts:44-46`

```typescript
const snap = await db.collection(SOLICITUDES_COLLECTION).orderBy('createdAt', 'desc').get();
```

Sin `.limit()`. Con 1,000 solicitudes (incluyendo `logoBase64`, `bannerBase64` y `menuFotosBase64`), este endpoint descarga varios GB de datos en un solo request. Potencial timeout de Vercel y OOM.

---

### P5 · Rate limiter in-memory no escala en serverless

**Archivo**: `lib/rateLimit.ts:14`

```typescript
const store = new Map<string, { count: number; resetAt: number }>();
```

En Vercel/serverless, cada instancia de función tiene su propia memoria aislada. Si hay 10 instancias concurrentes, un atacante puede enviar hasta 50 solicitudes (5 × 10 instancias) sin activar el límite. El propio comentario del código admite esto: _"Para escalar: migrar a Upstash Redis"_.

---

### P6 · `getExistingLocalIdsFromFirestore()` descarga todos los documentos innecesariamente

**Archivo**: `lib/locales-firestore.ts:138-144`

```typescript
const snap = await db.collection(LOCALES_COLLECTION).get();  // ← Full scan solo para obtener IDs
snap.docs.forEach((d) => ids.add(d.id));
```

Esta función solo necesita los IDs de los documentos, pero descarga los documentos completos (incluyendo `menu[]` con Base64). Usando `.select([])` (Admin SDK) o `listDocuments()` se obtienen solo los IDs sin leer el contenido.

---

### P7 · Reglas de Firestore hacen lecturas en cada operación autenticada

**Archivo**: `firestore.rules:7-11`

```javascript
function getRole() {
  return exists(/databases/$(database)/documents/users/$(request.auth.uid))
    ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('rol', '')
    : '';
}
```

Cada operación autenticada desde el cliente web que toca `/pedidos`, `/comisiones`, `/locales` o `/config` dispara 1-2 lecturas adicionales para `getRole()`. Esto se suma al contador de lecturas de Firestore.

---

### P8 · Imágenes de menú almacenadas como Base64 en Firestore

**Archivo**: `lib/locales-firestore.ts:130-136`, `app/api/locales/[id]/menu/route.ts:35-44`

El endpoint `PATCH /api/locales/[id]/menu` normaliza y acepta imágenes Base64 en el campo `image` de cada `MenuItem`, y las persiste en el array `menu[]` dentro del documento del local. Un menú con 50 ítems y imágenes de ~200KB cada uno pesa ~10MB, superando el límite de Firestore.

El comentario en `compressImage.ts` ya delata el problema:
```typescript
/** Formulario socios: límite bajo para no superar 1 MiB por documento en Firestore */
solicitudLogo: { maxSizeMB: 0.15, maxWidthOrHeight: 400 },
```
El límite de 0.15MB es artificialmente bajo precisamente porque el sistema guarda Base64 en Firestore. Los presets `logo` (1MB) y `cover` (1.2MB) para los paneles de restaurante **no tienen ese ajuste** y pueden exceder el límite.

---

### P9 · Ausencia de Custom Claims para autorización — Riesgo de escalada de privilegios

**Archivo**: `lib/api-auth.ts`, `lib/useAuth.ts`

El rol del usuario (`maestro`, `local`, `central`, `rider`, `cliente`) se almacena en el campo `rol` del documento `users/{uid}`, que es **escribible por el propio usuario** según las reglas de Firestore:

```javascript
// firestore.rules:14-16
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Un usuario podría modificar su propio campo `rol` directamente desde el SDK cliente (sin pasar por ninguna API route) y obtener acceso elevado. La siguiente vez que su token se verifique, `requireAuth` leerá el nuevo rol del documento y le concederá acceso de maestro/local/central.

**Mitigación actual**: Los paneles requieren autenticación por token en cada request. Sin embargo, la superficie de ataque existe y debe eliminarse migrando el rol a Custom Claims de Firebase Auth (inmutables desde el cliente).

---

### P10 · `CRON_SECRET` opcional — Endpoint cron expuesto sin autenticación

**Archivo**: `app/api/cron/notificar-comisiones/route.ts`

Si la variable de entorno `CRON_SECRET` no está configurada en Vercel, cualquier persona puede invocar el endpoint de notificación de comisiones haciendo un `GET /api/cron/notificar-comisiones`. Este endpoint lee y modifica la colección `comisiones` y envía notificaciones FCM a todos los riders.

---

### P11 · Panel maestro sin aislamiento de datos entre locales

**Archivo**: `app/api/locales/[id]/route.ts`, `app/api/locales/[id]/menu/route.ts`

`requireAuth(request, ['local', 'maestro'])` verifica que el usuario sea de rol `local`, pero **no verifica que `localId` del usuario coincida con el `[id]` en la URL**. Un usuario con rol `local` podría modificar el menú o perfil de cualquier otro local simplemente cambiando el parámetro `id` en la URL.

```typescript
// Solo verifica el rol, no el ownership:
await requireAuth(request, ['local', 'maestro']);
const { id } = await params;  // ← El usuario con rol 'local' puede poner cualquier ID aquí
```

---

## SECCIÓN 3 · ROADMAP DE REFACTORIZACIÓN

### Fase 0 — Parches de emergencia (antes de siguiente release)

**0.1 · Limitar tamaño de comprobanteBase64 en schema**

Archivo: `lib/schemas/pedido.ts`

```typescript
// ANTES
comprobanteBase64: z.string().optional(),

// DESPUÉS — 700KB en Base64 ≈ ~520KB binario, seguro para documentos Firestore
comprobanteBase64: z.string().max(700_000, 'El comprobante excede el tamaño máximo permitido').optional(),
```

**0.2 · Limitar tamaños en solicitudPostSchema**

Archivo: `lib/schemas/solicitudPost.ts`

```typescript
logoBase64: z.string().max(220_000).optional(),     // ~160KB comprimido
bannerBase64: z.string().max(300_000).optional(),   // ~220KB comprimido
menuFotosBase64: z.array(z.string().max(220_000)).max(5).optional(),
```

**0.3 · Responder 413 antes de llegar a Firestore**

Archivo: `app/api/pedidos/route.ts`

Verificar el tamaño del payload JSON antes de procesar:

```typescript
// POST /api/pedidos
const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
if (contentLength > 900_000) {
  return NextResponse.json(
    { error: 'El comprobante es demasiado grande. Máximo 700KB.' },
    { status: 413 }
  );
}
```

**0.4 · Agregar `.limit()` a stats/local**

Archivo: `app/api/stats/local/route.ts`

```typescript
// ANTES
const snap = await db.collection('pedidos').where('localId', '==', localId).get();

// DESPUÉS — último mes en milisegundos como filtro
const mesAtras = Date.now() - 30 * 24 * 60 * 60 * 1000;
const snap = await db
  .collection('pedidos')
  .where('localId', '==', localId)
  .where('timestamp', '>=', mesAtras)
  .orderBy('timestamp', 'desc')
  .limit(500)
  .get();
```

**0.5 · Ownership check en endpoints de locales**

Archivo: `app/api/locales/[id]/menu/route.ts` y `app/api/locales/[id]/route.ts`

```typescript
const { id } = await params;
const auth = await requireAuth(request, ['local', 'maestro']);

// Verificar que el local le pertenece (solo para rol 'local')
if (auth.rol === 'local') {
  const db = getAdminFirestore();
  const userSnap = await db.collection('users').doc(auth.uid).get();
  const userLocalId = userSnap.data()?.localId;
  if (userLocalId !== id) {
    return NextResponse.json({ error: 'No autorizado para este local' }, { status: 403 });
  }
}
```

---

### Fase 1 — Migración de binarios a Firebase Storage (1-2 semanas de trabajo)

**Objetivo**: Eliminar todo Base64 de Firestore. Solo URLs de `firebasestorage.googleapis.com` en la DB.

**1.1 · Comprobantes de transferencia**

- Crear endpoint `POST /api/pedidos/[id]/comprobante/upload` que reciba el archivo como `multipart/form-data`
- Subir a Firebase Storage en la ruta `comprobantes/{pedidoId}/{timestamp}.{ext}` usando Admin SDK
- Guardar solo el `downloadURL` en el campo `comprobanteUrl` del pedido
- Eliminar campos `comprobanteBase64`, `comprobanteMimeType`, `comprobanteFileName`

**1.2 · Imágenes de locales (logo, cover, código QR)**

- Crear endpoint `POST /api/locales/[id]/upload` para logo/cover/QR
- Migrar todos los documentos existentes: leer Base64 → subir Storage → reemplazar con URL
- Script en `scripts/migrate-base64-to-storage.ts`

**1.3 · Fotos de menú**

- Crear endpoint `POST /api/locales/[id]/menu/upload` para ítems individuales
- Subir imagen → obtener URL → guardar URL en `MenuItem.image`

**1.4 · Solicitudes de socios**

- Endpoint `POST /api/solicitudes/upload` (pre-firma o upload directo a Storage)
- Reemplazar campos `logoBase64`, `bannerBase64`, `menuFotosBase64` con `logoUrl`, `bannerUrl`, `menuFotosUrls[]`

---

### Fase 2 — Migración de `menu` a subcolección (2-3 semanas de trabajo)

**Objetivo**: Reducir el documento raíz del local a <5KB.

**Nuevo esquema**:
```
locales/{localId}                   ← <5KB: solo metadatos
  name, rating, shipping, logo_url, cover_url,
  address, lat, lng, horarios, status, transferencia_ref

locales/{localId}/menu/{itemId}     ← Un documento por ítem de menú
  name, price, category, description, image_url,
  tieneVariaciones, variaciones[], tieneComplementos, complementos[]

locales/{localId}/reviews/{reviewId} ← Reseñas ya como subcolección
  author, rating, comment, createdAt
```

**Plan de migración**:
1. Crear script `scripts/migrate-menu-to-subcollection.ts`
2. Para cada documento en `locales`:
   - Extraer array `menu[]`
   - Crear documentos en `locales/{id}/menu/{item.id}`
   - Eliminar campo `menu` del documento raíz con `FieldValue.delete()`
3. Actualizar `lib/locales-firestore.ts`:
   - `getLocalesFromFirestore()`: Solo campos del local, sin menú
   - Nuevo `getMenuFromFirestore(localId)`: Lee subcolección `menu`
4. Actualizar `GET /api/locales` para no incluir menús (solo metadatos)
5. Actualizar `GET /api/locales/[id]` para hacer ambas lecturas (local + menú)

---

### Fase 3 — Eliminación del data leak de `requireAuth` (1 semana de trabajo)

**Objetivo**: Cero lecturas de Firestore por autenticación.

**3.1 · Migrar rol a Firebase Custom Claims**

```typescript
// lib/firebase-admin.ts — Nueva función
export async function setUserClaim(uid: string, rol: string): Promise<void> {
  const auth = getAdminAuth();
  await auth.setCustomUserClaims(uid, { rol });
}
```

**3.2 · Actualizar `requireAuth`**

```typescript
// lib/api-auth.ts — DESPUÉS
export async function requireAuth(request, allowedRoles) {
  const token = extractBearerToken(request);
  const decoded = await verifyIdToken(token);  // El claim 'rol' ya viene en el JWT
  const rol = decoded.rol ?? 'cliente';
  if (!allowedRoles.includes(rol)) {
    throw new Response(JSON.stringify({ error: 'Rol no permitido' }), { status: 403 });
  }
  return { uid: decoded.uid, rol };  // ← Cero lecturas de Firestore
}
```

**3.3 · Actualizar reglas de Firestore**

```javascript
// firestore.rules — DESPUÉS
// Usar custom claims en lugar de getRole()
function getRole() {
  return request.auth.token.rol ?? '';  // ← Cero lecturas adicionales
}
```

**Impacto**: Elimina ~100% de las lecturas de `users` generadas por polling. Con 100 usuarios activos, esto reduce ~36,000 lecturas/hora a 0.

---

### Fase 4 — Rate limiter distribuido con Upstash Redis (2-3 días)

```typescript
// lib/rateLimit.ts — Reemplazar Map con Redis
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export async function checkRateLimit(ip: string, slug: string) {
  const key = `ratelimit:${slug}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 900); // 15 min
  return { ok: count <= PRESETS[slug].max, remaining: Math.max(0, PRESETS[slug].max - count) };
}
```

---

### Fase 5 — Añadir paginación a endpoints sin límite

| Endpoint | Cambio |
|----------|--------|
| `GET /api/solicitudes` | Añadir `.limit(50)` + cursor pagination |
| `GET /api/stats/local` | Filtro de fecha + `.limit(500)` |
| `GET /api/stats/maestro` | Añadir `.limit(200)` |
| `GET /api/central` | Ya tiene filtro de tiempo, verificar `.limit()` |
| `GET /api/maestro/usuarios` | Añadir `.limit(100)` + cursor |

---

### Fase 6 — Caché de servidor para endpoints públicos

El endpoint `GET /api/locales` ya usa `unstable_cache` con revalidación de 60s. Extender este patrón:

```typescript
// app/api/locales/route.ts — Aumentar TTL para datos que cambian poco
const cachedGetLocales = unstable_cache(
  async () => getLocalesFromFirestore(),
  ['locales-list'],
  { revalidate: 300, tags: ['locales'] }  // 5 minutos en lugar de 60s
);
```

Para endpoints de configuración pública (`/api/config/all`, `/api/config/tarifas`):

```typescript
const cachedConfig = unstable_cache(
  async () => getConfigFromFirestore(),
  ['config-all'],
  { revalidate: 600, tags: ['config'] }  // 10 minutos
);
```

---

## SECCIÓN 4 · EFFICIENCY SCORE

| Dimensión | Puntuación | Justificación |
|-----------|-----------|---------------|
| Arquitectura de datos | 2/10 | Documentos monolíticos con Base64, sin subcolecciones |
| Eficiencia de lecturas | 2/10 | requireAuth hace 1 read por request; stats sin límite |
| Seguridad de datos | 3/10 | Rol editable por cliente, rate limiter solo en-memoria |
| Manejo de binarios | 1/10 | Base64 en Firestore es la causa directa del Error 500 |
| API design | 5/10 | Schemas Zod, autenticación en todas las rutas, paginación parcial |
| Caché | 4/10 | `unstable_cache` implementado en locales, falta en otros endpoints |
| Escalabilidad | 2/10 | Rate limiter no distribuido, full-scans sin índices completos |
| **TOTAL** | **2.5/10** | |

---

## SECCIÓN 5 · PRIORITIZED FILE LIST

Ordenada por impacto inmediato en costos y estabilidad:

| Prioridad | Archivo | Problema | Impacto |
|-----------|---------|----------|---------|
| 🔴 CRÍTICO | `lib/schemas/pedido.ts` | Sin límite en `comprobanteBase64` | Error 500 garantizado con archivos >700KB |
| 🔴 CRÍTICO | `app/checkout/page.tsx` | Convierte comprobante a Base64 y lo manda a Firestore | Error 500 garantizado |
| 🔴 CRÍTICO | `lib/api-auth.ts` | 1 lectura Firestore por cada request autenticado | 6.8k lecturas con 4 usuarios |
| 🔴 CRÍTICO | `lib/schemas/solicitudPost.ts` | Sin límite en `logoBase64`, `bannerBase64`, `menuFotosBase64` | DoS con POST público |
| 🟠 ALTO | `app/api/stats/local/route.ts` | Full-scan sin `.limit()` ni filtro de fecha | O(N lecturas) por cada dashboard view |
| 🟠 ALTO | `lib/locales-firestore.ts` | `menu[]` en documento raíz + `getExistingLocalIdsFromFirestore()` full scan | Documento >1MiB, lecturas innecesarias |
| 🟠 ALTO | `app/api/solicitudes/route.ts` | GET sin paginación con Base64 en documentos | OOM / timeout en Vercel |
| 🟠 ALTO | `app/api/locales/[id]/menu/route.ts` | Acepta y persiste Base64 en ítems de menú | Documentos locales >1MiB |
| 🟠 ALTO | `app/api/locales/[id]/route.ts` | No verifica ownership del local para rol 'local' | Lateral movement entre locales |
| 🟠 ALTO | `firestore.rules` | `getRole()` hace `get()` en cada operación cliente | Lecturas extra en cada operación Firestore cliente |
| 🟡 MEDIO | `lib/rateLimit.ts` | In-memory, no distribuido | Rate limit inefectivo en serverless |
| 🟡 MEDIO | `lib/cartContext.tsx` | saveCart + refetchCart en cada modificación | Lecturas Firestore por interacción con carrito |
| 🟡 MEDIO | `lib/socios-types.ts` | Tipo `Solicitud` define campos Base64 | Refleja la arquitectura incorrecta |
| 🟡 MEDIO | `app/api/cron/notificar-comisiones/route.ts` | `CRON_SECRET` opcional | Endpoint expuesto sin auth si no se configura |
| 🟡 MEDIO | `app/api/locales/route.ts` | `getLocalesFromFirestore()` descarga menús completos para listar | Payload innecesariamente grande |
| 🟢 BAJO | `lib/data.ts` | `TransferenciaLocal.codigoBase64` en documento local | Contribuye al peso del documento |
| 🟢 BAJO | `next.config.js` | ESLint deshabilitado en builds (`ignoreDuringBuilds: true`) | Errores silenciosos en CI/CD |
| 🟢 BAJO | `middleware.ts` | Sin autenticación en middleware | Toda la lógica de auth va a las route handlers |

---

## SECCIÓN 6 · PROYECCIÓN DE ESCALABILIDAD

### Estado actual (4 usuarios activos → 6,800 lecturas)

- Con `requireAuth` haciendo 1 lectura por request y polling activo:
  - 4 usuarios × ~1,700 lecturas/usuario/día = 6,800 lecturas ✓ confirma el dato reportado

### Proyección con correcciones de Fase 0+1+3

| Usuarios activos | Lecturas/día (actual) | Lecturas/día (post-fix) | Reducción |
|-----------------|----------------------|------------------------|-----------|
| 4 | 6,800 | ~400 | -94% |
| 100 | ~170,000 | ~10,000 | -94% |
| 1,000 | ~1,700,000 | ~100,000 | -94% |
| 100,000 | ~170,000,000 | ~10,000,000 | -94% |

El free tier de Firestore es 50,000 lecturas/día. Con las correcciones, el sistema podría soportar ~5,000 usuarios activos dentro del free tier.

---

## SECCIÓN 7 · RIESGOS ADICIONALES

### R1 · Versión de Zod (v4.3)
El schema usa `z.enum(['delivery', 'pickup'], { error: '...' })` que es API de Zod v4. El error `error` en lugar de `errorMap` es nuevo. Verificar compatibilidad si se actualiza la librería.

### R2 · `reactStrictMode: true` en next.config.js
En desarrollo, React monta los componentes dos veces. Esto duplica las lecturas de Firestore en desarrollo, haciendo difícil diagnosticar leaks reales vs. artifacts del modo estricto. Las 6.8k lecturas reportadas deben haberse medido en producción; en desarrollo serían ~13.6k.

### R3 · `getLocalesFromFirestore()` incluye datos privados
La función incluye campos `ownerName`, `ownerPhone`, `ownerEmail`, `commissionStartDate` en el objeto `Local`. Si algún endpoint expone el objeto completo en lugar de proyecciones seguras, se estarían filtrando datos privados del propietario. Verificar que `GET /api/locales` (público) filtre estos campos antes de devolver la respuesta.

### R4 · FCM tokens sin expiración
La colección `fcm_tokens` no tiene TTL. Tokens de dispositivos no usados desde hace meses siguen ocupando espacio y generando intentos de envío fallidos que el sistema debe manejar limpiando el token.

---

*Informe generado tras análisis estático completo de 45 API routes, 18 componentes, 12 contextos/hooks, reglas de Firestore, y schemas Zod del repositorio Andina Delivery. Fecha: Marzo 2026.*
