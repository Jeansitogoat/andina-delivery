import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../lib/firebase-admin';

const EXECUTE = process.argv.includes('--execute');
const BATCH_SIZE = 200;
const LOCAL_STATS_SUBCOLLECTIONS = ['stats', 'stats_daily', 'stats_weekly', 'stats_monthly', 'stats_items'] as const;

async function countDocs(path: string[]): Promise<number> {
  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  if (path.length === 1) {
    query = db.collection(path[0]).limit(BATCH_SIZE);
  } else {
    query = db.collection(path[0]).doc(path[1]).collection(path[2]).limit(BATCH_SIZE);
  }

  let total = 0;
  while (true) {
    const snap = await query.get();
    total += snap.size;
    if (snap.size < BATCH_SIZE) break;
    query = query.startAfter(snap.docs[snap.docs.length - 1]);
  }
  return total;
}

async function deleteCollection(collection: FirebaseFirestore.CollectionReference): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await collection.limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = collection.firestore.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function main() {
  const db = getAdminFirestore();
  const localRefs = await db.collection('locales').listDocuments();

  const statsCountByLocal = await Promise.all(localRefs.map(async (localRef) => {
    const counts = await Promise.all(
      LOCAL_STATS_SUBCOLLECTIONS.map(async (sub) => ({
        sub,
        count: await countDocs(['locales', localRef.id, sub]),
      }))
    );
    return { localId: localRef.id, counts };
  }));

  const pedidosCount = await countDocs(['pedidos']);
  const comisionesCount = await countDocs(['comisiones']);
  const totalStatsDocs = statsCountByLocal.reduce(
    (sum, localEntry) => sum + localEntry.counts.reduce((inner, item) => inner + item.count, 0),
    0
  );

  console.log('Reset global de entorno de pruebas');
  console.log(`- pedidos: ${pedidosCount}`);
  console.log(`- comisiones: ${comisionesCount}`);
  console.log(`- docs stats locales: ${totalStatsDocs}`);

  if (!EXECUTE) {
    console.log('\nDry-run completado. Nada fue borrado.');
    console.log('Ejecuta: npx tsx scripts/reset-test-data-global.ts --execute');
    return;
  }

  const deletedPedidos = await deleteCollection(db.collection('pedidos'));
  const deletedComisiones = await deleteCollection(db.collection('comisiones'));

  let deletedStatsDocs = 0;
  for (const localRef of localRefs) {
    for (const sub of LOCAL_STATS_SUBCOLLECTIONS) {
      deletedStatsDocs += await deleteCollection(localRef.collection(sub));
    }
    await localRef.set({
      statsPedidosEntregados: FieldValue.delete(),
      statsIngresosEntregados: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log('\nBorrado completado:');
  console.log(`- pedidos eliminados: ${deletedPedidos}`);
  console.log(`- comisiones eliminadas: ${deletedComisiones}`);
  console.log(`- docs stats eliminados: ${deletedStatsDocs}`);
  console.log('- locales, productos y usuarios preservados');
}

main().catch((error) => {
  console.error('Fallo al resetear datos de prueba:', error);
  process.exit(1);
});
