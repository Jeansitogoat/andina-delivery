/**
 * Módulo central para el cálculo de comisiones de Andina Delivery.
 *
 * Regla de oro (única fuente de verdad):
 *  - Base: subtotal del pedido si está disponible; de lo contrario, total.
 *  - Tasa: 8% (comisión sobre venta al restaurante, sin envío).
 *  - Redondeo: enteros en centavos para evitar errores de punto flotante.
 *  - Idempotencia: usar pedidoId como docId en la colección "comisiones" para
 *    que reenvíos duplicados no generen dobles cobros.
 */

/** Calcula el monto de comisión en centavos (enteros) y devuelve el valor en pesos/dólares. */
export function calcularComision(total: number, subtotal?: number | null): number {
  const base = typeof subtotal === 'number' && !Number.isNaN(subtotal) && subtotal > 0
    ? subtotal
    : total;
  // Operación en centavos para evitar drift de float
  const centavos = Math.round(base * 100) * 8; // base * 8%  expresado en centavos×100
  return centavos / 10000;                      // volver a la unidad monetaria
}
