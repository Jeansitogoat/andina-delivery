/**
 * Complementos en carrito/pedidos: por grupo, array de opciones elegidas.
 * Compat: pedidos antiguos pueden tener un string por grupo.
 */
export type ComplementSelectionsMap = Record<string, string[]>;

/** Convierte valores legacy (string) a array; ordena opciones por grupo para comparación estable. */
export function normalizeComplementSelections(
  sel?: Record<string, string | string[]>
): ComplementSelectionsMap | undefined {
  if (!sel || Object.keys(sel).length === 0) return undefined;
  const out: ComplementSelectionsMap = {};
  for (const k of Object.keys(sel)) {
    const v = sel[k];
    if (Array.isArray(v)) {
      const arr = v.map((x) => String(x).trim()).filter(Boolean);
      if (arr.length) out[k] = [...new Set(arr)].sort();
    } else if (v != null && String(v).trim()) {
      out[k] = [String(v).trim()];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function complementSelectionsKey(sel?: Record<string, string | string[]>): string {
  const n = normalizeComplementSelections(sel);
  if (!n || Object.keys(n).length === 0) return '';
  return JSON.stringify(
    Object.keys(n)
      .sort()
      .reduce((acc, k) => ({ ...acc, [k]: n[k] }), {} as ComplementSelectionsMap)
  );
}

/** Texto para tickets y UI (opciones separadas por coma por grupo). */
export function complementSelectionsDisplay(sel?: Record<string, string | string[]>): string {
  const n = normalizeComplementSelections(sel);
  if (!n) return '';
  return Object.keys(n)
    .sort()
    .map((k) => n[k].join(', '))
    .filter(Boolean)
    .join(', ');
}
