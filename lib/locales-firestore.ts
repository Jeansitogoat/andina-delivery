/**
 * Lectura/escritura de locales en Firestore.
 *
 * Fase 2 — Normalización de datos:
 * El menú ya no vive en el campo `menu[]` del documento raíz del local.
 * Cada ítem es un documento independiente en la subcolección `productos`.
 *
 * Esquema:
 *   locales/{localId}                   ← <5KB: solo metadatos del local
 *   locales/{localId}/productos/{itemId} ← un documento por ítem de menú
 *
 * Compatibilidad backward:
 * Al leer el menú, si la subcolección `productos` está vacía se lee el campo
 * `menu[]` legacy del documento raíz como fallback. Esto permite convivencia
 * durante la migración sin downtime.
 */
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Local, MenuItem, HorarioItem } from '@/lib/data';

const LOCALES_COLLECTION = 'locales';
const PRODUCTOS_SUBCOLLECTION = 'productos';

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

function docToMenuItem(data: Record<string, unknown>, id: string): MenuItem {
  return {
    id,
    name: String(data.name ?? ''),
    price: Number(data.price ?? 0),
    description: data.description != null ? String(data.description) : undefined,
    image: data.image != null ? String(data.image) : undefined,
    bestseller: Boolean(data.bestseller),
    category: String(data.category ?? ''),
    tieneVariaciones: Boolean(data.tieneVariaciones),
    variaciones: Array.isArray(data.variaciones) ? (data.variaciones as MenuItem['variaciones']) : undefined,
    tieneComplementos: Boolean(data.tieneComplementos),
    complementos: Array.isArray(data.complementos) ? (data.complementos as MenuItem['complementos']) : undefined,
  };
}

/**
 * Lee todos los locales (solo metadatos, sin menú).
 * Usado en GET /api/locales para el listado del home. Más rápido y liviano.
 */
export async function getLocalesFromFirestore(): Promise<{ locales: Local[] }> {
  const db = getAdminFirestore();
  const snap = await db.collection(LOCALES_COLLECTION).limit(200).get();
  const locales: Local[] = [];
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    locales.push(docToLocal(data, d.id));
  });
  return { locales };
}

/**
 * Lee el menú de un local desde la subcolección `productos`.
 * Fallback: si la subcolección está vacía, lee el campo `menu[]` legacy del documento raíz.
 */
export async function getMenuFromFirestore(localId: string): Promise<MenuItem[]> {
  const db = getAdminFirestore();
  const prodSnap = await db
    .collection(LOCALES_COLLECTION)
    .doc(localId)
    .collection(PRODUCTOS_SUBCOLLECTION)
    .orderBy('_order', 'asc')
    .get();

  if (!prodSnap.empty) {
    return prodSnap.docs.map((d) => docToMenuItem(d.data() as Record<string, unknown>, d.id));
  }

  // Fallback legacy: leer campo `menu[]` del documento raíz.
  const rootSnap = await db.collection(LOCALES_COLLECTION).doc(localId).get();
  if (!rootSnap.exists) return [];
  const data = rootSnap.data() as Record<string, unknown>;
  return Array.isArray(data.menu) ? (data.menu as MenuItem[]) : [];
}

/**
 * Lee un local completo (metadatos + menú) para las páginas de detalle.
 */
export async function getLocalFromFirestore(
  localId: string
): Promise<{ local: Local; menu: MenuItem[] } | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(LOCALES_COLLECTION).doc(localId).get();
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, unknown>;
  const menu = await getMenuFromFirestore(localId);
  return {
    local: docToLocal(data, doc.id),
    menu,
  };
}

/**
 * Escribe todos los metadatos del local + menú (para migración y creación inicial).
 * El menú se escribe en la subcolección `productos` (batch de escrituras).
 * Borra el campo `menu` legacy del documento raíz si existía.
 */
export async function setLocalInFirestore(
  localId: string,
  local: Local,
  menu: MenuItem[]
): Promise<void> {
  const db = getAdminFirestore();
  const { id: _id, ...rest } = local;

  // Escribir el documento raíz sin el campo menu[]
  const rootPayload = stripUndefined({
    ...rest,
    updatedAt: FieldValue.serverTimestamp(),
  });
  // Eliminar el campo menu legacy si existe
  (rootPayload as Record<string, unknown>).menu = FieldValue.delete();

  await db.collection(LOCALES_COLLECTION).doc(localId).set(rootPayload, { merge: true });

  // Escribir cada ítem como documento en la subcolección (batch de máx 500)
  if (menu.length > 0) {
    const batchSize = 400;
    for (let i = 0; i < menu.length; i += batchSize) {
      const chunk = menu.slice(i, i + batchSize);
      const batch = db.batch();
      chunk.forEach((item, idx) => {
        const ref = db
          .collection(LOCALES_COLLECTION)
          .doc(localId)
          .collection(PRODUCTOS_SUBCOLLECTION)
          .doc(item.id);
        batch.set(ref, { ...stripUndefined(item as unknown as Record<string, unknown>), _order: i + idx });
      });
      await batch.commit();
    }
  }
}

export type { HorarioItem };

export async function updateLocalInFirestore(
  localId: string,
  updates: Partial<Pick<Local, 'name' | 'address' | 'telefono' | 'status' | 'transferencia' | 'time' | 'shipping' | 'logo' | 'cover' | 'categories' | 'ownerName' | 'ownerPhone' | 'ownerEmail' | 'lat' | 'lng'>> & { cerradoHasta?: string | null; horarios?: HorarioItem[] }
): Promise<void> {
  // El menú vive en la subcolección productos; no actualizar el documento raíz con menu.
  const u = updates as Record<string, unknown>;
  if ('menu' in u) delete u.menu;

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

/**
 * Escribe el menú completo en la subcolección `productos`.
 * Borra los documentos anteriores que ya no están en el nuevo menú.
 * Elimina el campo `menu` legacy del documento raíz.
 */
export async function setMenuInFirestore(localId: string, menu: MenuItem[]): Promise<void> {
  const db = getAdminFirestore();
  const colRef = db.collection(LOCALES_COLLECTION).doc(localId).collection(PRODUCTOS_SUBCOLLECTION);

  // Obtener los IDs actuales para borrar los eliminados
  const existing = await colRef.listDocuments();
  const existingIds = new Set(existing.map((r) => r.id));
  const newIds = new Set(menu.map((i) => i.id));

  const batch = db.batch();

  // Borrar ítems eliminados
  existing.forEach((ref) => {
    if (!newIds.has(ref.id)) batch.delete(ref);
  });

  // Crear o actualizar los nuevos ítems
  menu.forEach((item, idx) => {
    const ref = colRef.doc(item.id);
    batch.set(ref, { ...stripUndefined(item as unknown as Record<string, unknown>), _order: idx });
    existingIds.delete(item.id);
  });

  await batch.commit();

  // Eliminar el campo menu legacy del documento raíz y actualizar timestamp
  await db.collection(LOCALES_COLLECTION).doc(localId).update({
    menu: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Obtiene solo los IDs de los locales existentes (sin descargar contenido).
 * Usa listDocuments() para evitar el full-scan con descarga de documentos.
 */
export async function getExistingLocalIdsFromFirestore(): Promise<Set<string>> {
  const db = getAdminFirestore();
  // listDocuments() obtiene solo las referencias (IDs) sin descargar el contenido de los documentos.
  // Evita el full-scan con descarga de menu[] completo que haría un .get() normal.
  const refs = await db.collection(LOCALES_COLLECTION).listDocuments();
  const ids = new Set<string>();
  refs.forEach((ref) => ids.add(ref.id));
  return ids;
}
