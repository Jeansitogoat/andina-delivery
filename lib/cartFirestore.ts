/**
 * Persistencia del carrito en Firestore.
 * users/{uid} -> { cart: CartState }
 * Firestore no acepta undefined; sanitizamos el objeto antes de guardar.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';

export interface CartState {
  stops: Array<{ localId: string; items: Array<{ id: string; qty: number; note?: string }> }>;
}

export async function getCart(uid: string): Promise<CartState> {
  if (!uid || !uid.trim()) return { stops: [] };
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const cart = data?.cart;
  if (!cart || !Array.isArray(cart?.stops)) return { stops: [] };
  return cart as CartState;
}

export async function saveCart(uid: string, cart: CartState): Promise<void> {
  if (!uid || !uid.trim()) return;
  const db = getFirestoreDb();
  const sanitized = sanitizeForFirestore({ cart });
  await setDoc(doc(db, 'users', uid), sanitized, { merge: true });
}
