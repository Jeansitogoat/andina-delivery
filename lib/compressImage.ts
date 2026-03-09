/**
 * Compresión automática de imágenes en el cliente.
 * Reduce tamaño y resolución antes de subir para no depender de que el usuario baje la imagen.
 */
import imageCompression from 'browser-image-compression';

const isImage = (file: File) => file.type.startsWith('image/');

export type Preset = 'avatar' | 'logo' | 'cover' | 'product' | 'solicitudLogo' | 'solicitudCover' | 'solicitudMenu' | 'banner';

const PRESETS: Record<Preset, { maxSizeMB: number; maxWidthOrHeight: number; initialQuality?: number }> = {
  avatar: { maxSizeMB: 0.5, maxWidthOrHeight: 400 },
  logo: { maxSizeMB: 1, maxWidthOrHeight: 512 },
  cover: { maxSizeMB: 1.2, maxWidthOrHeight: 1200, initialQuality: 0.88 },
  product: { maxSizeMB: 0.8, maxWidthOrHeight: 600, initialQuality: 0.88 },
  /** Formulario socios: límite bajo para no superar 1 MiB por documento en Firestore */
  solicitudLogo: { maxSizeMB: 0.15, maxWidthOrHeight: 400 },
  solicitudCover: { maxSizeMB: 0.2, maxWidthOrHeight: 500 },
  solicitudMenu: { maxSizeMB: 0.15, maxWidthOrHeight: 400 },
  /** Banners carrusel home: relación 3:1, carga rápida en móvil */
  banner: { maxSizeMB: 0.7, maxWidthOrHeight: 1100, initialQuality: 0.85 },
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
  const { maxSizeMB, maxWidthOrHeight, initialQuality } = PRESETS[preset];
  try {
    const options: Parameters<typeof imageCompression>[1] = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: file.type,
    };
    if (initialQuality != null && file.type !== 'image/png') {
      options.initialQuality = initialQuality;
    }
    const compressed = await imageCompression(file, options);
    return compressed;
  } catch (err) {
    console.warn('Compresión fallida, se usa archivo original:', err);
    return file;
  }
}
