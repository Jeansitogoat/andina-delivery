/**
 * Almacenamiento local de pedidos para el flujo checkout → seguimiento y pagos por transferencia.
 * Con backend, esto sería API + base de datos.
 */

const PREFIX_PEDIDO = 'andina_pedido_';
const KEY_ORDERS_PENDING = 'andina_orders_pending';

export interface PedidoStorage {
  codigo: string;
  paymentMethod: 'efectivo' | 'transferencia';
  paymentConfirmed: boolean;
  orderNum: string;
  direccionEntregar: string;
  localName?: string;
  localTime?: string;
  grandTotal: number;
  items: Array<{ id: string; name: string; price: number; qty: number }>;
}

export interface PendingTransferOrder {
  orderId: string;
  orderNum: string;
  total: number;
  direccion: string;
  items: string[];
  createdAt: number;
  /** Comprobante en base64 (imagen o PDF) para que el restaurante verifique */
  comprobanteBase64?: string;
  comprobanteFileName?: string;
  comprobanteMimeType?: string;
}

export function generateVerificationCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export function savePedido(orderId: string, data: PedidoStorage): void {
  try {
    localStorage.setItem(PREFIX_PEDIDO + orderId, JSON.stringify(data));
  } catch {
    // ignorar
  }
}

export function getPedido(orderId: string): PedidoStorage | null {
  try {
    const raw = localStorage.getItem(PREFIX_PEDIDO + orderId);
    if (!raw) return null;
    return JSON.parse(raw) as PedidoStorage;
  } catch {
    return null;
  }
}

export function confirmPayment(orderId: string): void {
  const data = getPedido(orderId);
  if (!data) return;
  data.paymentConfirmed = true;
  savePedido(orderId, data);
  const pending = getPendingOrders().filter((p) => p.orderId !== orderId);
  try {
    localStorage.setItem(KEY_ORDERS_PENDING, JSON.stringify(pending));
  } catch {
    // ignorar
  }
}

export function getPendingOrders(): PendingTransferOrder[] {
  try {
    const raw = localStorage.getItem(KEY_ORDERS_PENDING);
    if (!raw) return [];
    return JSON.parse(raw) as PendingTransferOrder[];
  } catch {
    return [];
  }
}

export function addPendingOrder(order: PendingTransferOrder): void {
  const pending = getPendingOrders();
  pending.push(order);
  try {
    localStorage.setItem(KEY_ORDERS_PENDING, JSON.stringify(pending));
  } catch {
    // ignorar
  }
}

/** Actualiza la orden pendiente con el comprobante de transferencia (imagen o PDF en base64). */
export function updatePendingOrderComprobante(
  orderId: string,
  comprobanteBase64: string,
  fileName: string,
  mimeType: string
): void {
  const pending = getPendingOrders();
  const idx = pending.findIndex((p) => p.orderId === orderId);
  if (idx === -1) return;
  pending[idx] = {
    ...pending[idx],
    comprobanteBase64,
    comprobanteFileName: fileName,
    comprobanteMimeType: mimeType,
  };
  try {
    localStorage.setItem(KEY_ORDERS_PENDING, JSON.stringify(pending));
  } catch {
    // ignorar
  }
}

/** Cambia un pedido de transferencia a efectivo (cliente cambia de opinión). Quita de pendientes y marca pago confirmado. */
export function switchToEfectivo(orderId: string): void {
  const data = getPedido(orderId);
  if (!data) return;
  data.paymentMethod = 'efectivo';
  data.paymentConfirmed = true;
  savePedido(orderId, data);
  const pending = getPendingOrders().filter((p) => p.orderId !== orderId);
  try {
    localStorage.setItem(KEY_ORDERS_PENDING, JSON.stringify(pending));
  } catch {
    // ignorar
  }
}

/** Cancela el pedido por transferencia y vuelve al checkout (regresar). Borra el pedido y lo quita de pendientes. */
export function cancelTransferOrder(orderId: string): void {
  try {
    localStorage.removeItem(PREFIX_PEDIDO + orderId);
  } catch {
    // ignorar
  }
  const pending = getPendingOrders().filter((p) => p.orderId !== orderId);
  try {
    localStorage.setItem(KEY_ORDERS_PENDING, JSON.stringify(pending));
  } catch {
    // ignorar
  }
}
