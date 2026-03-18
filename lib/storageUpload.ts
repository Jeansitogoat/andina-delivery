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

/**
 * Sube un archivo a Firebase Storage y devuelve la downloadURL.
 * Comprime la imagen si se especifica un preset y el archivo es una imagen.
 */
export async function uploadToStorage(
  file: File,
  storagePath: string,
  preset?: Preset
): Promise<UploadResult> {
  const storage = getFirebaseStorage();
  const fileToUpload = preset ? await compressImage(file, preset) : file;
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
