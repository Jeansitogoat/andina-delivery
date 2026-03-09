/**
 * Persistencia de direcciones del usuario en Firestore.
 * users/{uid} -> { addresses: DireccionGuardada[], selectedAddressId: string | null }
 * Firestore no acepta undefined; normalizamos cada dirección para usar null en campos opcionales.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';

function sanitizeAddress(d: DireccionGuardada): Record<string, unknown> {
  return {
    id: d.id,
    etiqueta: d.etiqueta,
    nombre: d.nombre,
    detalle: d.detalle,
    referencia: d.referencia ?? null,
    principal: d.principal,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
  };
}

export async function getAddresses(uid: string): Promise<DireccionGuardada[]> {
  if (!uid || !uid.trim()) return [];
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const arr = data?.addresses;
  if (!Array.isArray(arr)) return [];
  return arr as DireccionGuardada[];
}

export async function getSelectedAddressId(uid: string): Promise<string | null> {
  if (!uid || !uid.trim()) return null;
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const sid = data?.selectedAddressId;
  return typeof sid === 'string' ? sid : null;
}

export async function saveAddresses(uid: string, dirs: DireccionGuardada[]): Promise<void> {
  if (!uid || !uid.trim()) return;
  const db = getFirestoreDb();
  const sanitized = dirs.map((d) => sanitizeAddress(d));
  await setDoc(doc(db, 'users', uid), { addresses: sanitized }, { merge: true });
}

export async function setSelectedAddress(uid: string, id: string | null): Promise<void> {
  if (!uid || !uid.trim()) return;
  const db = getFirestoreDb();
  await setDoc(doc(db, 'users', uid), { selectedAddressId: id }, { merge: true });
}
