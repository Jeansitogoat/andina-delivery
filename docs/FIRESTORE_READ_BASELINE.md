# Baseline de lecturas Firestore (operativo)

## Objetivo

Medir antes y despues de los cambios para validar reduccion real de lecturas.

## Ventana minima

- Medir **24h** (ideal 72h) en horario normal de operacion.

## Que capturar

- Firestore Usage por dia:
  - `Document reads`
  - `Document writes`
- Top colecciones por lectura:
  - `pedidos`
  - `fcm_tokens`
  - `locales`
  - `users`
- Endpoints de mayor trafico:
  - `/api/pedidos/panel-restaurante`
  - `/api/pedidos`
  - `/api/central`
  - `/api/stats/local`

## Metodo recomendado

1. Abrir Firebase Console > Firestore Database > Usage.
2. Registrar capturas al inicio y fin de ventana (24h o 72h).
3. Guardar una tabla `before/after` con:
   - lecturas totales por dia
   - variacion porcentual
   - observaciones (picos por hora, incidentes, despliegues)

## Guardrails de rollout

- Flag de frontend:
  - `NEXT_PUBLIC_FEATURE_RESTAURANTE_UNIFIED=1` activa endpoint unificado.
  - `NEXT_PUBLIC_FEATURE_RESTAURANTE_UNIFIED=0` vuelve al flujo legacy.
- Criterio de rollback:
  - si aumenta latencia o se ocultan pedidos activos, volver flag a `0`.
  - revisar indices y limites antes de reactivar.

## Meta de aceptacion

- Reduccion de lecturas diarias >= 30% en semana 1.
- Sin regresion operacional en panel restaurante, central y rider.
