---
name: Plan final lecturas Firestore 2026Q1
overview: "Plan corto de cierre para reducir lecturas remanentes: unificar polling del panel restaurante, bajar límites de activos con paginación, recortar barridos de FCM por rol y consolidar stats con agregados."
todos:
  - id: baseline-usage
    content: Levantar línea base en Firebase Usage (24-72h) por colección y endpoint antes de tocar código.
    status: completed
  - id: restaurante-single-endpoint
    content: Unificar pedidos activos y pendientes de transferencia en un solo endpoint para evitar doble polling en panel restaurante.
    status: completed
  - id: restaurante-limit-cursor
    content: Reducir límite de activos a 20 (o 15) con cursor startAfter y botón Cargar más en panel restaurante.
    status: completed
  - id: pendientes-transferencia-tighten
    content: Ajustar /api/pedidos/pendientes-transferencia (si se mantiene) con límite bajo y fallback sin saltar a 100.
    status: completed
  - id: fcm-role-segmentation
    content: Evitar barrido completo en sendFCMToRole; segmentar por localId/target o usar documentos índice por audiencia.
    status: completed
  - id: stats-aggregates
    content: Migrar paneles de stats a docs agregados por local y periodo para evitar lecturas masivas por request.
    status: completed
  - id: indexes-hardening
    content: Crear/validar índices compuestos para eliminar rutas fallback que amplían lecturas.
    status: completed
  - id: rollout-guardrails
    content: Activar rollout por fases con comparación de métricas antes/después y rollback simple por flag.
    status: completed
isProject: false
---

# Plan final de optimización Firestore (estado real de la app)

## 1) Contexto actual (ya resuelto)

Ya están implementados avances importantes:

- Custom claims en auth y reglas (`requireAuth` + `firestore.rules`).
- Caché persistente en cliente (`persistentLocalCache`).
- Denormalización base en creación de pedidos.
- Paginación parcial en historial (`mis-pedidos`, entregados de restaurante).
- Normalización de locales/menu a subcolección `productos`.

Conclusión: no se necesita un plan grande de re-arquitectura total; se necesita un **plan de cierre** enfocado en los focos remanentes.

---

## 2) Objetivo de negocio

Reducir lecturas sin afectar operación en tiempo real de cocina, central y riders.

Meta sugerida:

- **Semana 1-2:** -30% a -50% de lecturas diarias.
- **Mes 1:** -50% a -70% sobre la línea base actual.

---

## 3) Fase A — Mayor impacto inmediato (panel restaurante)

### A1. Unificar doble polling en una sola llamada

Problema:

- El panel restaurante consulta cada 45s:
  - pedidos activos
  - pendientes por transferencia
- Eso duplica tráfico y lecturas por pestaña abierta.

Acción:

- Crear endpoint único, por ejemplo `GET /api/pedidos/panel-restaurante`.
- Responder en un payload:
  - `activos`
  - `pendientesTransferencia`
  - `nextCursorActivos` (si aplica)

Resultado esperado:

- Menos requests y menos lecturas repetidas por ciclo.

### A2. Limitar activos con cursor (sin romper UX)

Acción:

- Bajar límite de activos de 50 a 20 (ideal 15 si UX lo permite).
- Agregar `startAfter` para cargar más.
- En UI del panel restaurante mostrar botón `Ver más` cuando exista cursor.

Guardrail:

- Si local con alta carga se queda corto, subir temporalmente a 20.

---

## 4) Fase B — FCM y barridos amplios

### B1. Reducir costo de `sendFCMToRole`

Problema:

- `sendFCMToRole` recorre todos los tokens de un rol.

Acción:

- Evitar broadcast por rol cuando el evento es local.
- Priorizar envío segmentado por `localId` o audiencia concreta.
- Mantener limpieza de tokens inválidos como está.

Resultado esperado:

- Baja de lecturas en `fcm_tokens` y menor latencia de notificación.

---

## 5) Fase C — Stats por agregados (no por barrido)

### C1. Consolidar métricas en documentos de stats

Acción:

- Usar `locales/{localId}` o `locales/{localId}/stats/{periodo}` con contadores agregados.
- Actualizar con `FieldValue.increment` en transición de estado (`entregado`, etc.).
- Hacer que dashboards lean 1-3 documentos en lugar de cientos/miles.

Resultado esperado:

- Lecturas casi constantes por apertura de dashboard.

---

## 6) Fase D — Índices y eliminación de fallbacks caros

Acción:

- Auditar queries que hoy entran a `catch` por índice.
- Crear índices compuestos requeridos en Firebase Console.
- Eliminar fallbacks que re-lean lotes grandes (`limit(100)` o equivalentes).

Resultado esperado:

- Menos lecturas inesperadas y latencia más estable.

---

## 7) Plan de ejecución (2 semanas)

- **Día 1-2:** baseline de métricas + definición del endpoint unificado.
- **Día 3-5:** implementación fase A (endpoint + UI + cursor).
- **Día 6-7:** fase B (segmentación FCM).
- **Día 8-10:** fase C (agregados stats).
- **Día 11-12:** fase D (índices y limpieza de fallbacks).
- **Día 13-14:** comparación before/after + ajuste fino de límites.

---

## 8) Criterio de éxito

- Disminución medible de lecturas totales en Firebase Usage.
- Reducción de llamadas por ciclo en panel restaurante.
- Sin regresiones en tiempos de actualización de pedidos.
- Sin quejas operativas de locales/riders por datos faltantes.

---

## 9) Riesgos y mitigación

- Riesgo: límite bajo oculta pedidos activos.
  - Mitigación: cursor + botón `Ver más` + límite inicial 20.
- Riesgo: endpoint unificado aumenta complejidad.
  - Mitigación: contrato simple y tipos estrictos de respuesta.
- Riesgo: agregados desincronizados.
  - Mitigación: actualizar en puntos únicos de transición y auditar idempotencia.
