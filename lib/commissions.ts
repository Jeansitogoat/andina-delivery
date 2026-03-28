/**
 * Módulo central para el cálculo de comisiones de Andina Delivery.
 *
 * Regla de oro (única fuente de verdad):
 *  - Base: subtotal de productos + coste de servicio cobrado al cliente (serviceFee),
 *    si hay subtotalBase; sin envío ni propina. Sin subtotalBase: fallback al total del pedido.
 *  - Tasa: 8% (solo se muestra a locales como "Comisión Andina 8%").
 *  - Redondeo: enteros en centavos para evitar errores de punto flotante.
 *  - Idempotencia: usar pedidoId como docId en la colección "comisiones" para
 *    que reenvíos duplicados no generen dobles cobros.
 */

import { roundMoney } from '@/lib/order-money';

/** Comisión 8% sobre (subtotalBase + serviceFee al cliente), o fallback legacy. */
export function calcularComision(
  totalCliente: number,
  subtotalBase?: number | null,
  serviceFeeCliente?: number | null
): number {
  const sb =
    typeof subtotalBase === 'number' && !Number.isNaN(subtotalBase) && subtotalBase >= 0
      ? roundMoney(subtotalBase)
      : null;
  const fee =
    typeof serviceFeeCliente === 'number' && !Number.isNaN(serviceFeeCliente) && serviceFeeCliente > 0
      ? roundMoney(serviceFeeCliente)
      : 0;

  if (sb != null) {
    const base = roundMoney(sb + fee);
    const centavos = Math.round(base * 100) * 8;
    return roundMoney(centavos / 10000);
  }

  const base = roundMoney(
    typeof totalCliente === 'number' && !Number.isNaN(totalCliente) && totalCliente > 0 ? totalCliente : 0
  );
  const centavos = Math.round(base * 100) * 8;
  return roundMoney(centavos / 10000);
}

export function calcularNetoLocal(subtotalBase: number, montoComision: number): number {
  return roundMoney(subtotalBase - montoComision);
}
