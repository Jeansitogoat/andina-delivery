
/**
 * Script de migración completa — Fase 1 + Fase 2:
 *
 * 1. Mueve imágenes en Base64 de Firestore a Firebase Storage (logo, cover, QR de locales)
 * 2. Mueve menu[] del documento raíz de locales a subcolección `productos`
 * 3. Migra comprobantes Base64 de pedidos a Storage
 * 4. Migra imágenes Base64 de solicitudes a Storage
 *
 * Uso:
 *   npx tsx scripts/migrate-base64-to-storage.ts [--dry-run] [--only=locales|pedidos|solicitudes]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

function isBase64DataUrl(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:');
}

async function dataUrlToBuffer(dataUrl: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mimeType = header.match(/data:([^;]+);base64/)?.[1] ?? 'application/octet-stream';
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, mimeType, ext };
}

async function uploadBuffer(
  bucket: import('@google-cloud/storage').Bucket,
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<string> {
  const file = bucket.file(storagePath);
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function run() {
  const { getAdminFirestore, getAdminStorage } = await import('../lib/firebase-admin');
  const { FieldValue } = await import('firebase-admin/firestore');

  const db = getAdminFirestore();
  const bucket = getAdminStorage().bucket();

  console.log(`\n🚀  Migración Base64 → Storage (dry-run: ${DRY_RUN})\n`);

  // ========================
  // 1. LOCALES: logo, cover, QR y menu[]
  // ========================
  if (!onlyArg || onlyArg === 'locales') {
    console.log('📁  Migrando locales...\n');
    const localesSnap = await db.collection('locales').get();

    for (const localDoc of localesSnap.docs) {
      const id = localDoc.id;
      const data = localDoc.data();
      const updates: Record<string, unknown> = {};

      // Logo
      if (isBase64DataUrl(data.logo)) {
        console.log(`  🖼️   ${id}: migrando logo...`);
        if (!DRY_RUN) {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(data.logo);
          const url = await uploadBuffer(bucket, buffer, `locales/${id}/logo.${ext}`, mimeType);
          updates.logo = url;
        } else {
          console.log(`  🔵  [DRY-RUN] ${id}: se migraría logo`);
        }
      }

      // Cover
      if (isBase64DataUrl(data.cover)) {
        console.log(`  🖼️   ${id}: migrando cover...`);
        if (!DRY_RUN) {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(data.cover);
          const url = await uploadBuffer(bucket, buffer, `locales/${id}/cover.${ext}`, mimeType);
          updates.cover = url;
        }
      }

      // QR / codigoBase64 dentro de transferencia
      const transferencia = data.transferencia as Record<string, unknown> | undefined;
      if (transferencia && isBase64DataUrl(transferencia.codigoBase64)) {
        console.log(`  📱  ${id}: migrando QR de transferencia...`);
        if (!DRY_RUN) {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(transferencia.codigoBase64 as string);
          const url = await uploadBuffer(bucket, buffer, `locales/${id}/qr.${ext}`, mimeType);
          updates['transferencia.codigoUrl'] = url;
          updates['transferencia.codigoBase64'] = FieldValue.delete();
        }
      }

      // menu[] → subcolección productos
      const menuArray = Array.isArray(data.menu) ? data.menu : null;
      if (menuArray && menuArray.length > 0) {
        console.log(`  📦  ${id}: migrando ${menuArray.length} productos a subcolección...`);
        if (!DRY_RUN) {
          const batchSize = 400;
          for (let i = 0; i < menuArray.length; i += batchSize) {
            const chunk = menuArray.slice(i, i + batchSize);
            const batch = db.batch();
            for (const [idx, item] of chunk.entries()) {
              const itemId = String(item.id ?? `item-${i + idx}`);
              const ref = db.collection('locales').doc(id).collection('productos').doc(itemId);
              // Migrar imagen Base64 del ítem si tiene
              let itemData = { ...item, id: itemId, _order: i + idx };
              if (isBase64DataUrl(item.image)) {
                try {
                  const { buffer, mimeType, ext } = await dataUrlToBuffer(item.image as string);
                  const imgUrl = await uploadBuffer(bucket, buffer, `locales/${id}/menu/${itemId}.${ext}`, mimeType);
                  itemData = { ...itemData, image: imgUrl };
                } catch {
                  itemData = { ...itemData, image: '' };
                }
              }
              batch.set(ref, itemData);
            }
            await batch.commit();
          }
          updates.menu = FieldValue.delete();
        }
      }

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        updates.updatedAt = FieldValue.serverTimestamp();
        await db.collection('locales').doc(id).update(updates);
        console.log(`  ✅  ${id}: actualizado`);
      }
    }
  }

  // ========================
  // 2. PEDIDOS: comprobanteBase64
  // ========================
  if (!onlyArg || onlyArg === 'pedidos') {
    console.log('\n📁  Migrando pedidos con comprobanteBase64...\n');
    const pedidosSnap = await db.collection('pedidos')
      .where('comprobanteBase64', '!=', '')
      .limit(500)
      .get();

    console.log(`  Encontrados ${pedidosSnap.size} pedidos con comprobanteBase64\n`);

    for (const pedidoDoc of pedidosSnap.docs) {
      const id = pedidoDoc.id;
      const data = pedidoDoc.data();
      if (!isBase64DataUrl(data.comprobanteBase64)) continue;
      console.log(`  📄  ${id}: migrando comprobante...`);
      if (!DRY_RUN) {
        try {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(data.comprobanteBase64 as string);
          const url = await uploadBuffer(bucket, buffer, `comprobantes/${id}/comprobante.${ext}`, mimeType);
          await db.collection('pedidos').doc(id).update({
            comprobanteUrl: url,
            comprobanteBase64: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`  ✅  ${id}: comprobante migrado`);
        } catch (e) {
          console.error(`  ❌  ${id}: error`, e);
        }
      } else {
        console.log(`  🔵  [DRY-RUN] ${id}: se migraría comprobante`);
      }
    }
  }

  // ========================
  // 3. SOLICITUDES: logoBase64, bannerBase64, menuFotosBase64
  // ========================
  if (!onlyArg || onlyArg === 'solicitudes') {
    console.log('\n📁  Migrando solicitudes con imágenes Base64...\n');
    const solSnap = await db.collection('solicitudes').limit(200).get();

    for (const solDoc of solSnap.docs) {
      const id = solDoc.id;
      const data = solDoc.data();
      const updates: Record<string, unknown> = {};

      if (isBase64DataUrl(data.logoBase64)) {
        console.log(`  🖼️   sol/${id}: migrando logo...`);
        if (!DRY_RUN) {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(data.logoBase64 as string);
          const url = await uploadBuffer(bucket, buffer, `solicitudes/${id}/logo.${ext}`, mimeType);
          updates.logoUrl = url;
          updates.logoBase64 = FieldValue.delete();
        }
      }

      if (isBase64DataUrl(data.bannerBase64)) {
        console.log(`  🖼️   sol/${id}: migrando banner...`);
        if (!DRY_RUN) {
          const { buffer, mimeType, ext } = await dataUrlToBuffer(data.bannerBase64 as string);
          const url = await uploadBuffer(bucket, buffer, `solicitudes/${id}/banner.${ext}`, mimeType);
          updates.bannerUrl = url;
          updates.bannerBase64 = FieldValue.delete();
        }
      }

      if (Array.isArray(data.menuFotosBase64) && data.menuFotosBase64.length > 0) {
        const menuUrls: string[] = [];
        for (const [i, foto] of data.menuFotosBase64.entries()) {
          if (isBase64DataUrl(foto)) {
            console.log(`  🖼️   sol/${id}: migrando foto menú ${i}...`);
            if (!DRY_RUN) {
              const { buffer, mimeType, ext } = await dataUrlToBuffer(foto);
              const url = await uploadBuffer(bucket, buffer, `solicitudes/${id}/menu_${i}.${ext}`, mimeType);
              menuUrls.push(url);
            }
          }
        }
        if (menuUrls.length > 0 && !DRY_RUN) {
          updates.menuFotosUrls = menuUrls;
          updates.menuFotosBase64 = FieldValue.delete();
        }
      }

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        updates.updatedAt = FieldValue.serverTimestamp();
        await db.collection('solicitudes').doc(id).update(updates);
        console.log(`  ✅  sol/${id}: actualizado`);
      }
    }
  }

  console.log('\n✅  Migración completada.\n');
  if (DRY_RUN) {
    console.log('⚠️   Modo dry-run — ejecutar sin --dry-run para aplicar cambios.\n');
  }
}

run().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
