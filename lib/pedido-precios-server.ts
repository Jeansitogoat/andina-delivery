import type { MenuItem } from '@/lib/data';
import { roundMoney } from '@/lib/order-money';

function normLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Precio unitario servidor para una línea del carrito (menú Firestore).
 */
export function unitPriceFromMenuLine(
  menuItem: MenuItem,
  line: { variationName?: string }
): number {
  const vName = typeof line.variationName === 'string' ? line.variationName.trim() : '';
  if (vName && menuItem.tieneVariaciones && Array.isArray(menuItem.variaciones)) {
    const nv = normLabel(vName);
    const found = menuItem.variaciones.find((v) => normLabel(v.name) === nv);
    if (found) return roundMoney(found.price);
  }
  return roundMoney(menuItem.price);
}

/**
 * Suma subtotalBase desde ítems del carrito y precios del menú (Firestore).
 */
export function computeSubtotalFromItemsCart(
  items: Array<{ id: string; qty: number; variationName?: string }>,
  menuById: Map<string, MenuItem>
): { ok: true; subtotalBase: number } | { ok: false; error: string } {
  let sum = 0;
  for (const line of items) {
    const menuItem = menuById.get(line.id);
    if (!menuItem) {
      return { ok: false, error: `Producto no encontrado en el menú: ${line.id}` };
    }
    const unit = unitPriceFromMenuLine(menuItem, line);
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: 'Cantidad inválida en el carrito' };
    }
    sum += unit * qty;
  }
  return { ok: true, subtotalBase: roundMoney(sum) };
}
