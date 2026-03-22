---
name: Operación Andina 100%
overview: "Auditoría de 360 grados sobre Andina Delivery: cierre de 4 brechas de seguridad críticas en RBAC, hardening de schemas Zod, memoización del Panel Central, toasts en errores silenciosos, y fix del banner PWA."
todos:
  - id: rbac-comisiones-stats
    content: "Cerrar brechas RBAC en /api/comisiones y /api/stats/local: verificar auth.localId === localId para rol local"
    status: completed
  - id: rbac-pedidos-rider
    content: "Cerrar brecha RBAC en /api/pedidos/[id]: añadir else 403 al bloque rider para evitar caída al bloque genérico"
    status: completed
  - id: rbac-fcm-send
    content: "Cerrar brecha FCM send: para rol cliente siempre usar auth.uid ignorando uid del body"
    status: completed
  - id: rbac-batch-rider
    content: "Cerrar brecha batch: verificar riderId en pedidos del batch para rol rider"
    status: completed
  - id: schema-localPatch
    content: "lib/schemas/localPatch.ts: eliminar .passthrough() y añadir .max() a campos de texto"
    status: completed
  - id: schema-pedidoPatch
    content: "lib/schemas/pedidoPatch.ts: estado y accion como z.enum(), max en comprobanteBase64"
    status: completed
  - id: banner-pwa
    content: "components/NotificationPromptBanner.tsx: mensaje PWA claro en Android/desktop, botón condicional si no es standalone"
    status: completed
  - id: memo-central
    content: "app/panel/central/page.tsx: mover PanelCentralContent fuera del padre, useMemo en filtros de pedidos"
    status: completed
  - id: toasts-rider
    content: "app/panel/rider/page.tsx: toasts en onSnapshot errors y error subir foto; unificar sistema de toast"
    status: completed
  - id: dead-code-cron
    content: "app/api/cron/notificar-comisiones/route.ts: eliminar if (now < periodEnd) muerto; fix filtro batch en central"
    status: completed
isProject: false
---

# Operación Andina 100% — Plan de Auditoría Total

## Estado Real del Sistema (Pre-Auditoría)

Lo que ya se corrigió en sesiones anteriores (no tocar):

- `lib/useNotifications.ts`: guard PWA, delay 800ms, `waitForServiceWorker`, logs `[FCM]`
- `lib/fcm-send-server.ts`: payload `notification` + `android.priority:high` + `apns`
- Todos los endpoints con `.limit()`, `batchId` en `central/route.ts`, `fileToBase64` eliminado
- `lib/useLocales.ts` eliminado, `DIRECCIONES_EJEMPLO` eliminado

---

## FASE 1 — Seguridad: 4 Brechas Críticas + Schemas

### Brecha 1 — `app/api/comisiones/route.ts`

Un restaurante (`local`) puede ver las comisiones de cualquier otro local pasando `?localId=otro-id`.

Añadir después de obtener `localId` del query param:

```typescript
if (auth.rol === 'local' && auth.localId !== localId) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}
```

### Brecha 2 — `app/api/stats/local/route.ts`

Mismo patrón: un `local` puede ver estadísticas de otro restaurante.

Añadir verificación `auth.localId === localId` para el rol `local`.

### Brecha 3 — `app/api/pedidos/[id]/route.ts` (líneas 207–234)

El bloque `rider` solo tiene `return` dentro de `rechazar_carrera`. Cualquier otro payload de un rider cae al bloque genérico: puede marcar pedidos como entregado, asignarse propinas, confirmar pagos.

Añadir `else { return NextResponse.json({ error: 'Acción no permitida' }, { status: 403 }); }` al final del bloque `if (auth.rol === 'rider')`, antes del bloque genérico de actualizaciones.

### Brecha 4 — `app/api/fcm/send/route.ts` (línea 27)

Un cliente puede enviar notificaciones push a cualquier usuario pasando `uid` en el body.

Cambiar la lógica para que el rol `cliente` siempre use `auth.uid`:

```typescript
// Antes: effectiveUid = uid del body si no es null
// Después:
if (auth.rol === 'cliente') {
  effectiveUid = auth.uid; // Ignorar uid del body siempre
}
```

### Brecha 5 (moderada) — `app/api/pedidos/batch/[batchId]/estado/route.ts`

Un rider puede cambiar estado de batches que no le pertenecen.

Añadir verificación de que al menos un pedido del batch tenga `riderId === auth.uid` cuando el rol es `rider`.

### Schema: `lib/schemas/localPatch.ts`

- Eliminar `.passthrough()` — permite que un `local` auto-asigne campos como `isFeatured`, `commissionStartDate`
- Añadir `.max()` a campos de texto: `name` (100), `address` (200), `telefono` (20), `time` (50)
- Añadir whitelist de campos permitidos para rol `local` vs `maestro` en la ruta PATCH

### Schema: `lib/schemas/pedidoPatch.ts`

- Cambiar `estado: z.string()` a `z.enum(['esperando_rider','asignado','en_camino','entregado','cancelado_local','cancelado_rider','cancelado_central'])` con mensaje de error
- Cambiar `accion: z.string()` a `z.enum(['cancelar','rechazar_carrera','avanzar_estado'])`
- Añadir `.max(500_000)` a `comprobanteBase64`

---

## FASE 2 — FCM: Banner PWA Mejorado

### `components/NotificationPromptBanner.tsx`

El banner no menciona que las notificaciones solo funcionan con la app instalada como PWA. Modificar el mensaje para Android/desktop:

```typescript
// Antes:
'Te avisaremos del estado de tus pedidos'

// Después (cuando !isPWA() y !isIOS()):
'Para recibir notificaciones instala la app: en Chrome toca el ícono ⊕ en la barra de direcciones → "Instalar app"'
```

Y condicionar el botón de activar notificaciones para que solo esté habilitado si `isPWA()` — si no, el botón cambia a "Instalar app" con link a `/instalar` o instrucciones inline.

---

## FASE 3 — Performance: Memoización Panel Central

### `app/panel/central/page.tsx` — Problema crítico de arquitectura

`PanelCentralContent` está declarada **dentro** de `PanelCentralPage`. En cada re-render (cada 30 segundos de polling), React desmonta y remonta todo el árbol.

Mover `PanelCentralContent` **fuera** del componente padre como función de nivel de módulo, pasando los datos necesarios como props, o extraerla a su propio archivo `components/PanelCentralContent.tsx`.

### `app/panel/central/page.tsx` — `useMemo` en filtros de pedidos

```typescript
// Actualmente (sin memo — se recalcula cada render):
const pedidosFiltrados = pedidos.filter(...);
const pedidosActivos = pedidosFiltrados.filter(...);
const pedidosHistorial = pedidosFiltrados.filter(...);

// Corrección:
const pedidosFiltrados = useMemo(() => pedidos.filter(...), [pedidos, search, filtroEstado]);
const pedidosActivos = useMemo(() => pedidosFiltrados.filter(...), [pedidosFiltrados]);
const pedidosHistorial = useMemo(() => pedidosFiltrados.filter(...), [pedidosFiltrados]);
```

### `components/TarjetaPedidoCentral.tsx` — `React.memo`

Envolver con `React.memo` para evitar re-renders cuando el pedido no cambió. Las callbacks inline que recibe deben moverse a `useCallback` en el padre.

---

## FASE 4 — UX: Toasts en Errores Silenciosos

### `app/panel/rider/page.tsx`

- **Línea 189** (`onSnapshot` activas): añadir `showGlobalToast('Error al cargar carreras. Recargá la página.')` en el error handler
- **Línea 210** (`onSnapshot` historial): mismo toast
- **Línea 666** (subir foto): añadir `showGlobalToast('Error al subir foto. Intentá de nuevo.')` después del `console.error`
- Unificar el sistema de toasts: eliminar el `setToast` local y usar solo `showGlobalToast` del contexto

### `lib/addressesContext.tsx` (líneas 78, 96, 131, 179, 193)

Los errores de sync de direcciones son silenciosos. Añadir `console.warn` descriptivos (no toasts ya que son contextos de fondo — los toasts deben dispararse en el componente UI que llama la acción).

---

## FASE 5 — Lógica: Bug Batch y Código Muerto

### `app/api/cron/notificar-comisiones/route.ts`

Código muerto identificado — la condición `if (now < periodEnd) return` nunca se ejecuta (el `while` anterior ya garantiza `periodEnd <= now`). Eliminar el `if` muerto.

### `app/panel/central/page.tsx` — función `asignarRider`

El filtro del batch usa `p.batchLeaderLocalId === batchLeader` lo que puede dejar `paradas` vacío si el dato no está sincronizado. Simplificar a filtrar solo por `p.batchId === batchId` (sin el filtro de `batchLeaderLocalId`).

---

## Archivos a Modificar

- `[app/api/comisiones/route.ts](app/api/comisiones/route.ts)` — Brecha RBAC #1
- `[app/api/stats/local/route.ts](app/api/stats/local/route.ts)` — Brecha RBAC #2
- `[app/api/pedidos/[id]/route.ts](app/api/pedidos/%5Bid%5D/route.ts)` — Brecha RBAC #3
- `[app/api/fcm/send/route.ts](app/api/fcm/send/route.ts)` — Brecha RBAC #4
- `[app/api/pedidos/batch/[batchId]/estado/route.ts](app/api/pedidos/batch/%5BbatchId%5D/estado/route.ts)` — Brecha RBAC #5
- `[lib/schemas/localPatch.ts](lib/schemas/localPatch.ts)` — `.passthrough()` + límites
- `[lib/schemas/pedidoPatch.ts](lib/schemas/pedidoPatch.ts)` — `estado` + `accion` como enum
- `[components/NotificationPromptBanner.tsx](components/NotificationPromptBanner.tsx)` — mensaje PWA
- `[app/panel/central/page.tsx](app/panel/central/page.tsx)` — `PanelCentralContent` + `useMemo`
- `[app/panel/rider/page.tsx](app/panel/rider/page.tsx)` — toasts en errores silenciosos
- `[app/api/cron/notificar-comisiones/route.ts](app/api/cron/notificar-comisiones/route.ts)` — código muerto

---

## Fuera de Alcance (Requieren nueva feature, no auditoría)

- **GPS Tracking real**: `LogisticsTracking.tsx` es completamente decorativo (datos hardcodeados, sin mapa). Implementar tracking real (Leaflet + actualización de posición del rider) es una feature nueva de alcance grande, no un fix.
- **Skeleton primitivo genérico**: Los skeletons existentes son adecuados. Crear un primitivo `<Skeleton />` genérico es refactoring cosmético, no auditoría.
- **Responsive extremo en 1366px**: Requiere inspección visual en navegador; no hay evidencia de bugs concretos en el código.

