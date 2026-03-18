/**
 * Lectura/escritura de locales en Firestore (colección locales).
 * Cada documento tiene id = localId y campos de Local + menu (MenuItem[]).
 */
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Local, MenuItem, HorarioItem } from '@/lib/data';

const LOCALES_COLLECTION = 'locales';

/** Firestore no acepta undefined; eliminamos esas claves del payload. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function docToLocal(data: Record<string, unknown>, id: string): Local {
  const horarios = Array.isArray(data.horarios) ? (data.horarios as HorarioItem[]) : undefined;
  return {
    id,
    name: String(data.name ?? ''),
    rating: Number(data.rating ?? 0),
    reviews: Number(data.reviews ?? data.reviewsCount ?? 0),
    time: String(data.time ?? '20-35 min'),
    shipping: Number(data.shipping ?? 1.5),
    type: Array.isArray(data.type) ? (data.type as string[]) : ['Restaurantes'],
    distance: String(data.distance ?? '—'),
    destacado: Boolean(data.destacado),
    isFeatured: Boolean((data as { isFeatured?: boolean }).isFeatured),
    featuredUntil: typeof (data as { featuredUntil?: number }).featuredUntil === 'number'
      ? (data as { featuredUntil?: number }).featuredUntil!
      : null,
    logo: String(data.logo ?? ''),
    cover: String(data.cover ?? ''),
    address: data.address != null ? String(data.address) : undefined,
    lat: typeof data.lat === 'number' && !Number.isNaN(data.lat) ? data.lat : undefined,
    lng: typeof data.lng === 'number' && !Number.isNaN(data.lng) ? data.lng : undefined,
    minOrder: data.minOrder != null ? Number(data.minOrder) : undefined,
    categories: Array.isArray(data.categories) ? (data.categories as string[]) : ['Más pedidos'],
    transferencia: data.transferencia as Local['transferencia'],
    status: data.status as Local['status'],
    telefono: data.telefono != null ? String(data.telefono) : undefined,
    horarios,
    cerradoHasta: typeof data.cerradoHasta === 'string' ? data.cerradoHasta : (data.cerradoHasta != null && typeof (data.cerradoHasta as { toDate?: () => Date }).toDate === 'function' ? (data.cerradoHasta as { toDate: () => Date }).toDate().toISOString() : undefined),
    ownerName: data.ownerName != null ? String(data.ownerName) : undefined,
    ownerPhone: data.ownerPhone != null ? String(data.ownerPhone) : undefined,
    ownerEmail: data.ownerEmail != null ? String(data.ownerEmail) : undefined,
    commissionStartDate: typeof data.commissionStartDate === 'string' ? data.commissionStartDate : undefined,
  };
}

export async function getLocalesFromFirestore(): Promise<{ locales: Local[]; menus: Record<string, MenuItem[]> }> {
  const db = getAdminFirestore();
  const snap = await db.collection(LOCALES_COLLECTION).get();
  const locales: Local[] = [];
  const menus: Record<string, MenuItem[]> = {};
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    locales.push(docToLocal(data, d.id));
    menus[d.id] = Array.isArray(data.menu) ? (data.menu as MenuItem[]) : [];
  });
  return { locales, menus };
}

export async function getLocalFromFirestore(
  localId: string
): Promise<{ local: Local; menu: MenuItem[] } | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(LOCALES_COLLECTION).doc(localId).get();
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, unknown>;
  return {
    local: docToLocal(data, doc.id),
    menu: Array.isArray(data.menu) ? (data.menu as MenuItem[]) : [],
  };
}

export async function setLocalInFirestore(
  localId: string,
  local: Local,
  menu: MenuItem[]
): Promise<void> {
  const db = getAdminFirestore();
  const { id: _id, ...rest } = local;
  const payload = stripUndefined({
    ...rest,
    menu,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db
    .collection(LOCALES_COLLECTION)
    .doc(localId)
    .set(payload, { merge: true });
}

export type { HorarioItem };

export async function updateLocalInFirestore(
  localId: string,
  updates: Partial<Pick<Local, 'name' | 'address' | 'telefono' | 'status' | 'transferencia' | 'time' | 'shipping' | 'logo' | 'cover' | 'categories' | 'ownerName' | 'ownerPhone' | 'ownerEmail' | 'lat' | 'lng'>> & { cerradoHasta?: string | null; horarios?: HorarioItem[] }
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(LOCALES_COLLECTION).doc(localId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const obj: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (updates.name !== undefined) obj.name = updates.name;
  if (updates.address !== undefined) obj.address = updates.address;
  if (updates.lat !== undefined) obj.lat = updates.lat;
  if (updates.lng !== undefined) obj.lng = updates.lng;
  if (updates.telefono !== undefined) obj.telefono = updates.telefono;
  if (updates.status !== undefined) obj.status = updates.status;
  if (updates.transferencia !== undefined) obj.transferencia = updates.transferencia;
  if (updates.time !== undefined) obj.time = updates.time;
  if (updates.shipping !== undefined) obj.shipping = updates.shipping;
  if (updates.logo !== undefined) obj.logo = updates.logo;
  if (updates.cover !== undefined) obj.cover = updates.cover;
  if (updates.cerradoHasta !== undefined) obj.cerradoHasta = updates.cerradoHasta || null;
  if (updates.categories !== undefined && Array.isArray(updates.categories)) obj.categories = updates.categories;
  if ((updates as { horarios?: HorarioItem[] }).horarios !== undefined) obj.horarios = (updates as { horarios?: HorarioItem[] }).horarios;
  if (updates.ownerName !== undefined) obj.ownerName = updates.ownerName;
  if (updates.ownerPhone !== undefined) obj.ownerPhone = updates.ownerPhone;
  if (updates.ownerEmail !== undefined) obj.ownerEmail = updates.ownerEmail;
  await ref.update(obj);
}

export async function setMenuInFirestore(localId: string, menu: MenuItem[]): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(LOCALES_COLLECTION).doc(localId).update({
    menu,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getExistingLocalIdsFromFirestore(): Promise<Set<string>> {
  const db = getAdminFirestore();
  // listDocuments() obtiene solo las referencias (IDs) sin descargar el contenido de los documentos.
  // Evita el full-scan con descarga de menu[] completo que haría un .get() normal.
  const refs = await db.collection(LOCALES_COLLECTION).listDocuments();
  const ids = new Set<string>();
  refs.forEach((ref) => ids.add(ref.id));
  return ids;
}
