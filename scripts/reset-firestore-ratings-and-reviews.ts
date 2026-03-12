/**
 * Resetea ratings y reseñas de locales en Firestore para dejar la app limpia de datos de demo.
 *
 * Ejecutar una sola vez desde la raíz del proyecto:
 *   npx tsx scripts/reset-firestore-ratings-and-reviews.ts
 *
 * Requisitos:
 *   - Variables de entorno / credenciales ya configuradas para firebase-admin
 *   - Acceso a las colecciones `reviews` y `locales`
 */
import { getAdminFirestore } from '../lib/firebase-admin';

async function purgeReviews(db: FirebaseFirestore.Firestore) {
  const reviewsSnap = await db.collection('reviews').get();
  if (reviewsSnap.empty) {
    console.log('No hay documentos en reviews. Nada que borrar.');
    return;
  }
  console.log('Eliminando reseñas de la colección reviews…', reviewsSnap.size);
  const batchSize = 400;
  let batch = db.batch();
  let opCount = 0;
  reviewsSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
    opCount++;
    if (opCount === batchSize) {
      batch.commit().catch((e) => console.error('Error al hacer commit de batch de reviews', e));
      batch = db.batch();
      opCount = 0;
    }
  });
  if (opCount > 0) {
    await batch.commit();
  }
  console.log('Colección reviews purgada.');
}

async function resetLocalesRatings(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection('locales').get();
  if (snap.empty) {
    console.log('No hay locales en Firestore. Nada que actualizar.');
    return;
  }
  console.log('Reseteando rating/reviews en locales…', snap.size);
  const batchSize = 400;
  let batch = db.batch();
  let opCount = 0;
  snap.docs.forEach((doc) => {
    const ref = doc.ref;
    batch.update(ref, {
      rating: 0,
      reviews: 0,
      reviewsCount: 0,
      ratingSum: 0,
    });
    opCount++;
    if (opCount === batchSize) {
      batch.commit().catch((e) => console.error('Error al hacer commit de batch de locales', e));
      batch = db.batch();
      opCount = 0;
    }
  });
  if (opCount > 0) {
    await batch.commit();
  }
  console.log('Ratings de locales reseteados.');
}

async function main() {
  const db = getAdminFirestore();
  await purgeReviews(db);
  await resetLocalesRatings(db);
  console.log('Limpieza de datos de demo completada.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

