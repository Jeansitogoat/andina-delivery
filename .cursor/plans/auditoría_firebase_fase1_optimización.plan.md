# Auditoría Firebase + Fase 1 de optimización (sin ejecutar aún)

Este documento extiende la auditoría de costos/lecturas con la **Fase 1** acordada: fugas **CRÍTICAS** y **MEDIAS**. La ejecución de código queda pendiente de confirmación explícita.

---

## Estado del trabajo

- **Auditoría previa:** resumida en secciones 1–4 (listeners, modelo, paginación, caché).
- **Fase 1 (pendiente de implementación):** parches exactos descritos abajo.

---

## Fase 1 — Parches de código (especificación)

### 1. Eliminar polling agresivo (CRÍTICO)

**Archivo:** [`app/pedido/[id]/page.tsx`](app/pedido/[id]/page.tsx)

- Eliminar la lógica de `setInterval` que hace polling HTTP a `GET /api/pedidos/[id]`.
- **Preferido:** reemplazar por `onSnapshot` directo al documento Firestore `pedidos/{id}` desde el cliente (Firebase Client SDK), con `unsubscribe()` en cleanup al desmontar.
- **Alternativa** (si las reglas de seguridad no permiten lectura directa del pedido desde el cliente): mantener la API pero sustituir polling por **SWR o React Query** con `refreshInterval` largo (p. ej. 15s) y **detener el refresh** cuando el estado sea terminal (`entregado` o cualquier `cancelado_*`).

### 2. Arreglar re-suscripción en panel rider (MEDIO)

**Archivo:** [`app/panel/rider/page.tsx`](app/panel/rider/page.tsx)

- El `useEffect` que registra las **tres** suscripciones `onSnapshot` (pedidos activos, mandados, historial) **no** debe incluir `filtroHistorial` en el array de dependencias.
- Mover el filtrado del historial a **memoria**: `useMemo`, estado derivado, o un `useEffect` **separado** que solo filtre la lista ya cargada, sin desmontar listeners.

### 3. Desnormalizar rating del rider (MEDIO)

**Archivos:** [`app/api/pedidos/[id]/route.ts`](app/api/pedidos/[id]/route.ts) (PATCH asignación + GET)

- En la asignación de rider por Central, leer del documento `users/{riderId}` el `ratingPromedio` (y opcionalmente foto) y persistirlos en el pedido como **`riderRatingSnapshot`** (y campo de foto si se define nombre estable, p. ej. `riderPhotoURLSnapshot`).
- En **GET** `/api/pedidos/[id]`: si el documento del pedido ya incluye `riderRatingSnapshot`, **no** hacer `getDoc` adicional a `users` para rating.

### 4. Verificación post-implementación

- Builds (`tsc` / build Next) sin romperse.
- Listeners cerrados correctamente (`unsubscribe` en cleanup).

---

## Reglas de seguridad e índices (Firestore)

### Reglas (`firestore.rules`)

| Cambio | ¿Hace falta tocar reglas? | Notas |
|--------|---------------------------|--------|
| **`onSnapshot` en `pedidos/{id}` desde el cliente** | **Sí, casi seguro** | Hoy el cliente puede depender solo de la API (Admin). Para leer `pedidos/{pedidoId}` desde el SDK cliente hace falta una regla del estilo: `allow read: if request.auth != null && (resource.data.clienteId == request.auth.uid || resource.data.riderId == request.auth.uid || resource.data.localId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.localId || ...)` según roles ya usados en la app. Revisar coherencia con la lógica actual de [`GET` en la API](app/api/pedidos/[id]/route.ts) (cliente dueño, local del pedido, rider asignado, central/maestro). |
| **Solo alternativa SWR/React Query contra API** | **No** en reglas para lectura del pedido vía API (sigue siendo servidor con Admin). | Sin cambio de reglas para el documento pedido en cliente. |
| **Campos nuevos `riderRatingSnapshot` (y foto)** | **No** obligatorio | Son campos en el mismo doc `pedidos/{id}`; las reglas de `update` deben seguir restringiendo quién escribe (normalmente solo servidor/Admin o reglas ya existentes). Si solo la API Admin escribe esos campos, las reglas cliente para `update` de pedidos pueden no cambiar. |

**Conclusión:** Si se elige **onSnapshot en cliente**, la Fase 1 debe incluir una **revisión explícita** de `firestore.rules` (y pruebas con usuario cliente/rider/local) para evitar lecturas denegadas o excesivas.

### Índices compuestos (`firestore.indexes.json`)

| Cambio | ¿Nuevo índice? |
|--------|----------------|
| Lectura por ID de documento `pedidos/{id}` | **No** — lectura de documento único no requiere índice compuesto adicional. |
| PATCH que añade campos al pedido | **No** — no cambia queries. |
| Panel rider (solo quitar dependencia del efecto) | **No** — las queries existentes no cambian. |

**Conclusión:** No se anticipan índices nuevos **solo** por estos tres parches. Si en el mismo PR se modifican queries (`where` + `orderBy` nuevos), habrá que validar enlaces de error de Firestore y añadir índices según el mensaje.

---

## To-dos de implementación (Fase 1)

1. Pedido: reemplazar polling por snapshot o SWR/React Query con intervalo largo y stop en terminal.
2. Rider: separar dependencias del efecto de listeners; filtrar historial en memoria.
3. API pedidos: escribir `riderRatingSnapshot` al asignar; GET condicional sin `getDoc` de usuario.
4. Reglas: validar lectura cliente a `pedidos/{id}` si se usa `onSnapshot`.
5. Verificar build y unsubscribes.

---

## Referencia

Auditoría original: fugas, joins, límites y caché (informe previo en conversación). Este archivo es la fuente para **ejecutar** cuando el usuario indique explícitamente (p. ej. "implementa el plan" / "ejecuta Fase 1").
