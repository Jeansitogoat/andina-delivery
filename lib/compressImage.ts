/**
 * Compresión automática de imágenes en el cliente.
 * Reduce tamaño y resolución antes de subir para no depender de que el usuario baje la imagen.
 */
import imageCompression from 'browser-image-compression';

const isImage = (file: File) => file.type.startsWith('image/');

export type Preset = 'avatar' | 'logo' | 'cover' | 'product' | 'solicitudLogo' | 'solicitudCover' | 'solicitudMenu' | 'banner';

const PRESETS: Record<Preset, { maxSizeMB: number; maxWidthOrHeight: number }> = {
  avatar: { maxSizeMB: 1, maxWidthOrHeight: 400 },
  logo: { maxSizeMB: 1.5, maxWidthOrHeight: 512 },
  cover: { maxSizeMB: 2, maxWidthOrHeight: 1200 },
  product: { maxSizeMB: 1, maxWidthOrHeight: 600 },
  /** Formulario socios: límite bajo para no superar 1 MiB por documento en Firestore */
  solicitudLogo: { maxSizeMB: 0.15, maxWidthOrHeight: 400 },
  solicitudCover: { maxSizeMB: 0.2, maxWidthOrHeight: 500 },
  solicitudMenu: { maxSizeMB: 0.15, maxWidthOrHeight: 400 },
  /** Banners carrusel home: relación 3:1, recomendado 1200×400 */
  banner: { maxSizeMB: 1.5, maxWidthOrHeight: 1200 },
};

/**
 * Comprime un archivo de imagen para que pese menos y tenga un tamaño razonable.
 * Si no es imagen, devuelve el archivo sin cambios.
 */
export async function compressImage(
  file: File,
  preset: Preset = 'avatar'
): Promise<File> {
  if (!isImage(file)) return file;
  const { maxSizeMB, maxWidthOrHeight } = PRESETS[preset];
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: file.type,
    });
    return compressed;
  } catch (err) {
    console.warn('Compresión fallida, se usa archivo original:', err);
    return file;
  }
}
