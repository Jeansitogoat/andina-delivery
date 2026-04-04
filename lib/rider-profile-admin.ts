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

/** Una sola lectura de `users/{riderId}` para asignación: nombre + snapshots en el pedido. */
export async function getRiderProfileForPedidoAssignment(
  db: Firestore,
  riderId: string
): Promise<{
  displayName: string;
  riderRatingSnapshot: number | null;
  riderPhotoURLSnapshot: string | null;
}> {
  const snap = await db.collection('users').doc(riderId).get();
  if (!snap.exists) {
    return { displayName: 'Repartidor', riderRatingSnapshot: null, riderPhotoURLSnapshot: null };
  }
  const d = snap.data() ?? {};
  const displayName = typeof d.displayName === 'string' ? d.displayName.trim() : '';
  const email = typeof d.email === 'string' ? d.email.trim() : '';
  const nombre = displayName || email || 'Repartidor';
  const riderRatingSnapshot =
    d.ratingPromedio != null && !Number.isNaN(Number(d.ratingPromedio))
      ? Number(d.ratingPromedio)
      : null;
  const riderPhotoURLSnapshot =
    typeof d.photoURL === 'string' && d.photoURL.trim() ? d.photoURL.trim() : null;
  return { displayName: nombre, riderRatingSnapshot, riderPhotoURLSnapshot };
}
