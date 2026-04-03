/**
 * Utilidad de upload a Firebase Storage desde el cliente (browser).
 * Reemplaza el flujo anterior de conversión a Base64 + guardado en Firestore.
 *
 * Rutas de Storage:
 *   comprobantes/{pedidoId}/{timestamp}_{filename}  ← comprobantes de transferencia
 *   locales/{localId}/logo                          ← logo del local
 *   locales/{localId}/cover                         ← portada del local
 *   locales/{localId}/qr                            ← código QR de pago
 *   locales/{localId}/menu/{itemId}                 ← imagen de ítem de menú
 *   solicitudes/{solicitudId}/logo                  ← logo en formulario socios
 *   solicitudes/{solicitudId}/banner                ← banner en formulario socios
 *   solicitudes/{solicitudId}/menu/{index}          ← fotos de menú en formulario socios
 */
import { ref, uploadBytes, getDownloadURL, type StorageReference } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/firebase/client';
import { compressImage, type Preset } from '@/lib/compressImage';

export interface UploadResult {
  url: string;
  path: string;
}

function storageFileSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sube un archivo a Firebase Storage y devuelve la downloadURL.
 * Toda imagen se comprime antes de uploadBytes (preset o 'avatar' por defecto). No imágenes: sin cambios.
 */
export async function uploadToStorage(
  file: File,
  storagePath: string,
  preset?: Preset
): Promise<UploadResult> {
  const storage = getFirebaseStorage();
  const fileToUpload = file.type.startsWith('image/')
    ? await compressImage(file, preset ?? 'avatar')
    : file;
  const storageRef: StorageReference = ref(storage, storagePath);
  await uploadBytes(storageRef, fileToUpload);
  const url = await getDownloadURL(storageRef);
  return { url, path: storagePath };
}

/** Sube el logo de un local. */
export async function uploadLocalLogo(localId: string, file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `locales/${localId}/logo`, 'logo');
  return url;
}

/** Sube la portada de un local. */
export async function uploadLocalCover(localId: string, file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `locales/${localId}/cover`, 'cover');
  return url;
}

/** Sube el código QR/Deuna de un local. Sin compresión para PDFs; compresión ligera para imágenes. */
export async function uploadLocalQr(localId: string, file: File): Promise<string> {
  const preset = file.type.startsWith('image/') ? ('avatar' as Preset) : undefined;
  const ext = file.name.split('.').pop() ?? 'bin';
  const { url } = await uploadToStorage(file, `locales/${localId}/qr.${ext}`, preset);
  return url;
}

/** Sube la imagen de un producto del menú. */
export async function uploadMenuItemImage(localId: string, itemId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadToStorage(file, `locales/${localId}/menu/${itemId}.${ext}`, 'product');
  return url;
}

/** Sube el comprobante de transferencia de un pedido. */
export async function uploadComprobante(pedidoId: string, file: File): Promise<string> {
  const ts = Date.now();
  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { url } = await uploadToStorage(
    file,
    `comprobantes/${pedidoId}/${ts}_${safeName}.${ext}`,
    // Solo comprimir si es imagen; PDFs no se comprimen
    file.type.startsWith('image/') ? 'avatar' : undefined
  );
  return url;
}

/** Sube el logo de una solicitud de socio. Ruta temporal hasta que se apruebe. */
export async function uploadSolicitudLogo(tempId: string, file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `solicitudes/${tempId}/logo`, 'solicitudLogo');
  return url;
}

/** Sube el banner de una solicitud de socio. */
export async function uploadSolicitudBanner(tempId: string, file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `solicitudes/${tempId}/banner`, 'solicitudCover');
  return url;
}

/** Sube una foto de menú de una solicitud de socio. */
export async function uploadSolicitudMenuFoto(tempId: string, index: number, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadToStorage(
    file,
    `solicitudes/${tempId}/menu_${index}.${ext}`,
    'solicitudMenu'
  );
  return url;
}

/** Banner del carrusel (panel maestro). Ruta: banners/{idAleatorio} */
export async function uploadBannerImage(file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `banners/${storageFileSuffix()}`, 'banner');
  return url;
}

/** Logo al crear/editar local desde panel maestro (ruta histórica locales/logos/). */
export async function uploadMaestroLocalLogo(file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `locales/logos/${storageFileSuffix()}`, 'logo');
  return url;
}

/** Portada al crear/editar local desde panel maestro (ruta histórica locales/covers/). */
export async function uploadMaestroLocalCover(file: File): Promise<string> {
  const { url } = await uploadToStorage(file, `locales/covers/${storageFileSuffix()}`, 'cover');
  return url;
}

/** URL HTTPS de descarga de Firebase Storage. */
export function isFirebaseStorageHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'firebasestorage.googleapis.com' || u.hostname === 'storage.googleapis.com';
  } catch {
    return false;
  }
}

/** Path del objeto dentro del bucket, decodificado desde URL v0 de Firebase Storage. */
export function decodeFirebaseStorageObjectPathFromUrl(downloadUrl: string): string | null {
  try {
    const u = new URL(downloadUrl);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const idx = u.pathname.indexOf('/o/');
    if (idx === -1) return null;
    const encoded = u.pathname.slice(idx + 3);
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Descarga una imagen desde su URL de Storage, la comprime y la sube de nuevo al mismo path.
 * La nueva `getDownloadURL` puede diferir (token). Usar el valor devuelto en Firestore.
 */
export async function recompressFirebaseImageAtUrl(
  downloadUrl: string,
  preset: Preset,
  fallbackStoragePath?: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`fetch failed ${res.status}`);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('not an image');
  }
  const ext =
    blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : blob.type.includes('gif') ? 'gif' : 'jpg';
  const file = new File([blob], `opt.${ext}`, { type: blob.type || 'image/jpeg' });
  const compressed = await compressImage(file, preset);

  const pathDecoded = decodeFirebaseStorageObjectPathFromUrl(downloadUrl);
  const pathResolved = pathDecoded ?? fallbackStoragePath;
  let storageRef: StorageReference = ref(storage, downloadUrl);
  try {
    await uploadBytes(storageRef, compressed, {
      contentType: compressed.type || 'image/jpeg',
    });
    return getDownloadURL(storageRef);
  } catch (firstErr) {
    if (!pathResolved) {
      throw firstErr;
    }
    storageRef = ref(storage, pathResolved);
    await uploadBytes(storageRef, compressed, {
      contentType: compressed.type || 'image/jpeg',
    });
    return getDownloadURL(storageRef);
  }
}
