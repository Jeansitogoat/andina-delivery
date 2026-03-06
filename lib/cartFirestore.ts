/**
 * Persistencia del carrito en Firestore.
 * users/{uid} -> { cart: CartState }
 * Firestore no acepta undefined; sanitizamos el objeto antes de guardar.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';

export interface CartState {
  stops: Array<{ localId: string; items: Array<{ id: string; qty: number; note?: string }> }>;
}

/** Elimina valores undefined recursivamente (Firestore no los acepta). */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeForFirestore(v)) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = sanitizeForFirestore(v);
    }
    return out as T;
  }
  return obj;
}

export async function getCart(uid: string): Promise<CartState> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const cart = data?.cart;
  if (!cart || !Array.isArray(cart?.stops)) return { stops: [] };
  return cart as CartState;
}

export async function saveCart(uid: string, cart: CartState): Promise<void> {
  const db = getFirestoreDb();
  const sanitized = sanitizeForFirestore({ cart });
  await setDoc(doc(db, 'users', uid), sanitized, { merge: true });
}
