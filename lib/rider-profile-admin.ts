import type { Firestore } from 'firebase-admin/firestore';

/** Nombre para mostrar en el pedido (denormalizado). */
export async function getRiderDisplayNameForPedido(db: Firestore, riderId: string): Promise<string> {
  const snap = await db.collection('users').doc(riderId).get();
  if (!snap.exists) return 'Repartidor';
  const d = snap.data() ?? {};
  const displayName = typeof d.displayName === 'string' ? d.displayName.trim() : '';
  if (displayName) return displayName;
  const email = typeof d.email === 'string' ? d.email.trim() : '';
  if (email) return email;
  return 'Repartidor';
}
