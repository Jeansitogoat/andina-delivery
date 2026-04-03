/**
 * Herramienta temporal (panel maestro): recorre locales y productos, comprime imágenes
 * ya alojadas en Firebase Storage y actualiza Firestore con la nueva URL + flags de idempotencia.
 * Procesamiento secuencial (sin Promise.all) para no saturar cliente ni cuotas.
 */
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import { isFirebaseStorageHttpsUrl, recompressFirebaseImageAtUrl } from '@/lib/storageUpload';

const PRODUCTOS_SUB = 'productos';

export type OptimizarImagenesResult = {
  optimized: number;
  skippedIdempotent: number;
  errors: number;
  sinUrlStorage: number;
};

export async function runOptimizarImagenesAntiguas(
  onProgress: (message: string) => void
): Promise<OptimizarImagenesResult> {
  const out: OptimizarImagenesResult = {
    optimized: 0,
    skippedIdempotent: 0,
    errors: 0,
    sinUrlStorage: 0,
  };

  const db = getFirestoreDb();
  const localesSnap = await getDocs(collection(db, 'locales'));

  for (const localDoc of localesSnap.docs) {
    const localId = localDoc.id;
    const data = localDoc.data() as Record<string, unknown>;
    const localName = String(data.name ?? localId);

    onProgress(`Procesando local: ${localName}…`);

    const logoUrl = typeof data.logo === 'string' ? data.logo.trim() : '';
    if (logoUrl && !logoUrl.startsWith('data:')) {
      if (isFirebaseStorageHttpsUrl(logoUrl)) {
        if (data.logoOptimizada === true) {
          onProgress(`Logo de ${localName} ya optimizado, omitiendo…`);
          out.skippedIdempotent += 1;
        } else {
          try {
            onProgress(`Comprimiendo logo de ${localName}…`);
            const newUrl = await recompressFirebaseImageAtUrl(logoUrl, 'logo', `locales/${localId}/logo`);
            await updateDoc(doc(db, 'locales', localId), {
              logo: newUrl,
              logoOptimizada: true,
            });
            out.optimized += 1;
          } catch (e) {
            console.error('[optimizar logo]', localId, e);
            out.errors += 1;
          }
        }
      } else {
        onProgress(`Logo de ${localName} no es URL de Firebase Storage, omitiendo…`);
        out.sinUrlStorage += 1;
      }
    }

    const coverUrl = typeof data.cover === 'string' ? data.cover.trim() : '';
    if (coverUrl && !coverUrl.startsWith('data:')) {
      if (isFirebaseStorageHttpsUrl(coverUrl)) {
        if (data.coverOptimizada === true) {
          onProgress(`Portada de ${localName} ya optimizada, omitiendo…`);
          out.skippedIdempotent += 1;
        } else {
          try {
            onProgress(`Comprimiendo portada de ${localName}…`);
            const newUrl = await recompressFirebaseImageAtUrl(coverUrl, 'cover', `locales/${localId}/cover`);
            await updateDoc(doc(db, 'locales', localId), {
              cover: newUrl,
              coverOptimizada: true,
            });
            out.optimized += 1;
          } catch (e) {
            console.error('[optimizar cover]', localId, e);
            out.errors += 1;
          }
        }
      } else {
        onProgress(`Portada de ${localName} no es URL de Firebase Storage, omitiendo…`);
        out.sinUrlStorage += 1;
      }
    }

    const prodSnap = await getDocs(collection(db, 'locales', localId, PRODUCTOS_SUB));
    const total = prodSnap.size;
    if (total === 0 && Array.isArray(data.menu) && (data.menu as unknown[]).length > 0) {
      onProgress(`Local ${localName}: menú solo en documento raíz (legacy), productos omitidos.`);
    }

    let idx = 0;
    for (const prodDoc of prodSnap.docs) {
      idx++;
      const pdata = prodDoc.data() as Record<string, unknown>;
      const itemName = String(pdata.name ?? prodDoc.id);
      const imgUrl = typeof pdata.image === 'string' ? pdata.image.trim() : '';

      if (!imgUrl || imgUrl.startsWith('data:')) continue;

      if (!isFirebaseStorageHttpsUrl(imgUrl)) {
        onProgress(`Producto "${itemName}": imagen no es Firebase Storage, omitiendo…`);
        out.sinUrlStorage += 1;
        continue;
      }

      if (pdata.imagenOptimizada === true) {
        onProgress(`Producto "${itemName}" ya optimizado, omitiendo…`);
        out.skippedIdempotent += 1;
        continue;
      }

      try {
        onProgress(`Comprimiendo producto ${idx} de ${total}: ${itemName}…`);
        const newUrl = await recompressFirebaseImageAtUrl(
          imgUrl,
          'product',
          `locales/${localId}/menu/${prodDoc.id}.jpg`
        );
        await updateDoc(doc(db, 'locales', localId, PRODUCTOS_SUB, prodDoc.id), {
          image: newUrl,
          imagenOptimizada: true,
        });
        out.optimized += 1;
      } catch (e) {
        console.error('[optimizar producto]', localId, prodDoc.id, e);
        out.errors += 1;
      }
    }
  }

  return out;
}
