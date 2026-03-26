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

import { roundMoney } from '@/lib/order-money';

/** Calcula el monto de comisión sobre subtotalBase (8%). */
export function calcularComision(total: number, subtotalBase?: number | null): number {
  const base = typeof subtotalBase === 'number' && !Number.isNaN(subtotalBase) && subtotalBase > 0
    ? subtotalBase
    : total;
  // Operación en centavos para evitar drift de float
  const centavos = Math.round(base * 100) * 8; // base * 8%  expresado en centavos×100
  return roundMoney(centavos / 10000);          // volver a la unidad monetaria
}

export function calcularNetoLocal(subtotalBase: number, montoComision: number): number {
  return roundMoney(subtotalBase - montoComision);
}
