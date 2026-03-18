/**
 * Script de migración: mueve menu[] del campo raíz de cada local
 * a la subcolección locales/{id}/productos/{item.id}.
 *
 * También migra imágenes en Base64 a Firebase Storage si FIREBASE_SERVICE_ACCOUNT_JSON está disponible.
 *
 * Uso:
 *   npx tsx scripts/migrate-menu-to-subcollection.ts [--dry-run]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const { getAdminFirestore } = await import('../lib/firebase-admin');
  const { FieldValue } = await import('firebase-admin/firestore');

  const db = getAdminFirestore();
  const localesSnap = await db.collection('locales').get();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`\n🔍  Procesando ${localesSnap.size} locales... (dry-run: ${DRY_RUN})\n`);

  for (const localDoc of localesSnap.docs) {
    const localId = localDoc.id;
    const data = localDoc.data();
    const menuArray = Array.isArray(data.menu) ? data.menu : null;

    if (!menuArray || menuArray.length === 0) {
      // Verificar si ya tiene subcolección productos
      const prodSnap = await db.collection('locales').doc(localId).collection('productos').limit(1).get();
      if (!prodSnap.empty) {
        console.log(`  ✅  ${localId}: ya migrado a subcolección, sin campo menu[]`);
        skipped++;
      } else {
        console.log(`  ⏭️   ${localId}: sin menu[] ni subcolección (local vacío)`);
        skipped++;
      }
      continue;
    }

    console.log(`  📦  ${localId}: migrando ${menuArray.length} productos...`);

    if (!DRY_RUN) {
      try {
        const batchSize = 400;
        for (let i = 0; i < menuArray.length; i += batchSize) {
          const chunk = menuArray.slice(i, i + batchSize);
          const batch = db.batch();
          chunk.forEach((item: Record<string, unknown>, idx: number) => {
            const itemId = String(item.id ?? `item-${i + idx}`);
            const ref = db.collection('locales').doc(localId).collection('productos').doc(itemId);
            const { id: _id, ...rest } = item;
            batch.set(ref, { id: itemId, ...rest, _order: i + idx });
          });
          await batch.commit();
        }

        // Eliminar campo menu[] del documento raíz
        await db.collection('locales').doc(localId).update({
          menu: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`  ✅  ${localId}: ${menuArray.length} productos migrados y campo menu[] eliminado`);
        migrated++;
      } catch (e) {
        console.error(`  ❌  ${localId}: error en migración`, e);
        errors++;
      }
    } else {
      console.log(`  🔵  [DRY-RUN] ${localId}: se migraría menu[] con ${menuArray.length} items`);
      migrated++;
    }
  }

  console.log(`\n📊  Resumen:`);
  console.log(`    Migrados:  ${migrated}`);
  console.log(`    Omitidos:  ${skipped}`);
  console.log(`    Errores:   ${errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️   Modo dry-run activo — no se realizaron cambios. Ejecutar sin --dry-run para aplicar.\n');
  } else {
    console.log('\n✅  Migración completada.\n');
  }
}

run().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
