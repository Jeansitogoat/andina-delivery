import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

type AggregateInput = {
  localId: string;
  pedidoId: string;
  total: number;
  timestamp: number;
  items: string[];
};

function formatDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatWeekKey(ts: number): string {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeItemName(raw: string): { name: string; qty: number } | null {
  const line = (raw || '').trim();
  if (!line) return null;
  const qtyPrefix = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  const qty = qtyPrefix ? Math.max(parseInt(qtyPrefix[1], 10) || 1, 1) : 1;
  const name = (qtyPrefix ? qtyPrefix[2] : line).trim();
  if (!name) return null;
  return { name, qty };
}

function itemDocId(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'item';
}

function setMerge(
  db: Firestore,
  path: string[],
  payload: Record<string, unknown>,
  pendingWrites: Promise<unknown>[],
  tx?: Transaction
): void {
  const ref = db.collection(path[0]).doc(path[1]).collection(path[2]).doc(path[3]);
  if (tx) tx.set(ref, payload, { merge: true });
  else pendingWrites.push(ref.set(payload, { merge: true }));
}

export async function applyDeliveredOrderAggregates(
  db: Firestore,
  input: AggregateInput,
  tx?: Transaction
): Promise<void> {
  const safeTotal = Number.isFinite(input.total) ? Number(input.total) : 0;
  const ts = Number.isFinite(input.timestamp) && input.timestamp > 0 ? input.timestamp : Date.now();
  const dayKey = formatDayKey(ts);
  const weekKey = formatWeekKey(ts);
  const monthKey = formatMonthKey(ts);
  const pendingWrites: Promise<unknown>[] = [];

  const localesRef = db.collection('locales').doc(input.localId);
  const rootPayload = {
    statsPedidosEntregados: FieldValue.increment(1),
    statsIngresosEntregados: FieldValue.increment(safeTotal),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (tx) tx.set(localesRef, rootPayload, { merge: true });
  else pendingWrites.push(localesRef.set(rootPayload, { merge: true }));

  setMerge(
    db,
    ['locales', input.localId, 'stats', 'resumen'],
    {
      pedidosEntregados: FieldValue.increment(1),
      ingresosEntregados: FieldValue.increment(safeTotal),
      updatedAt: FieldValue.serverTimestamp(),
    },
    pendingWrites,
    tx
  );
  setMerge(
    db,
    ['locales', input.localId, 'stats_daily', dayKey],
    {
      pedidosEntregados: FieldValue.increment(1),
      ingresosEntregados: FieldValue.increment(safeTotal),
      updatedAt: FieldValue.serverTimestamp(),
    },
    pendingWrites,
    tx
  );
  setMerge(
    db,
    ['locales', input.localId, 'stats_weekly', weekKey],
    {
      pedidosEntregados: FieldValue.increment(1),
      ingresosEntregados: FieldValue.increment(safeTotal),
      updatedAt: FieldValue.serverTimestamp(),
    },
    pendingWrites,
    tx
  );
  setMerge(
    db,
    ['locales', input.localId, 'stats_monthly', monthKey],
    {
      pedidosEntregados: FieldValue.increment(1),
      ingresosEntregados: FieldValue.increment(safeTotal),
      updatedAt: FieldValue.serverTimestamp(),
    },
    pendingWrites,
    tx
  );

  for (const rawItem of input.items || []) {
    const parsed = normalizeItemName(rawItem);
    if (!parsed) continue;
    const ref = db
      .collection('locales')
      .doc(input.localId)
      .collection('stats_items')
      .doc(itemDocId(parsed.name));
    const payload = {
      nombre: parsed.name,
      cantidad: FieldValue.increment(parsed.qty),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (tx) tx.set(ref, payload, { merge: true });
    else pendingWrites.push(ref.set(payload, { merge: true }));
  }
  if (!tx && pendingWrites.length > 0) {
    await Promise.all(pendingWrites);
  }
}
