/**
 * Valida si una cadena es una URL de imagen válida para usar en <img src>.
 * Evita ERR_INVALID_URL por data: truncados o URLs mal formadas.
 */
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024; // 2 MB; navegadores pueden rechazar data URLs muy largas

const BASE64_REGEX = /^[A-Za-z0-9+/]+=*$/;

function normalizeAndValidateBase64(base64Raw: string): boolean {
  const base64 = base64Raw.replace(/\s/g, '');
  if (base64.length < 10) return false;
  if (!BASE64_REGEX.test(base64)) return false;
  try {
    return atob(base64).length > 0;
  } catch {
    return false;
  }
}

/** Normaliza una data URL quitando espacios/saltos en el base64 (Chrome es estricto). */
export function normalizeDataUrl(s: string): string {
  const trimmed = s.trim();
  if (!trimmed.startsWith('data:')) return trimmed;
  const comma = trimmed.indexOf(',');
  if (comma === -1) return trimmed;
  const header = trimmed.slice(0, comma);
  const base64 = trimmed.slice(comma + 1).replace(/\s/g, '');
  return header + ',' + base64;
}

export function isValidImageUrl(url: string | undefined | null): boolean {
  if (url == null || typeof url !== 'string' || url.trim() === '') return false;
  const s = url.trim();
  if (s.startsWith('data:')) {
    if (s.length > MAX_DATA_URL_LENGTH) return false;
    const comma = s.indexOf(',');
    if (comma === -1) return false;
    const header = s.slice(0, comma);
    const base64 = s.slice(comma + 1);
    if (!/^data:image\/[a-z+]+;base64$/i.test(header)) return false;
    if (s.length < 50) return false;
    return normalizeAndValidateBase64(base64);
  }
  if (s.startsWith('blob:')) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Tipos de data URL permitidos para iframe/href (comprobantes PDF o imagen). */
const DATA_URL_HEADERS = [
  /^data:image\/[a-z+]+;base64$/i,
  /^data:application\/pdf;base64$/i,
];

/**
 * Valida si una cadena es una data URL válida (imagen o PDF) para usar en
 * <iframe src> o <a href> (comprobantes). Evita ERR_INVALID_URL.
 */
export function isValidDataUrl(url: string | undefined | null): boolean {
  if (url == null || typeof url !== 'string' || url.trim() === '') return false;
  const s = url.trim();
  if (!s.startsWith('data:')) return false;
  if (s.length > MAX_DATA_URL_LENGTH) return false;
  const comma = s.indexOf(',');
  if (comma === -1) return false;
  const header = s.slice(0, comma);
  const base64 = s.slice(comma + 1);
  const headerOk = DATA_URL_HEADERS.some((re) => re.test(header));
  if (!headerOk) return false;
  if (s.length < 50) return false;
  return normalizeAndValidateBase64(base64);
}

/**
 * Devuelve la data URL si es válida (imagen o PDF), normalizada para Chrome.
 * Usar en iframe src y enlaces de descarga de comprobantes.
 */
export function getSafeDataUrl(url: string | undefined | null): string | undefined {
  if (!isValidDataUrl(url)) return undefined;
  const s = url!.trim();
  return s.startsWith('data:') ? normalizeDataUrl(s) : s;
}

/**
 * Devuelve la URL si es válida, normalizada para data URLs (Chrome).
 * Usar en img src y next/image para evitar ERR_INVALID_URL.
 */
export function getSafeImageSrc(url: string | undefined | null): string | undefined {
  if (!isValidImageUrl(url)) return undefined;
  const s = url!.trim();
  return s.startsWith('data:') ? normalizeDataUrl(s) : s;
}

/**
 * Evita el optimizador de Next.js en Vercel (cuota / error 402): Firebase Storage,
 * data/blob URLs y avatares de Google (mismas lecturas remotas que suelen agotar créditos).
 */
export function shouldBypassImageOptimizer(src: string | null | undefined): boolean {
  if (!src || typeof src !== 'string') return false;
  const s = src.trim();
  if (s.startsWith('data:') || s.startsWith('blob:')) return true;
  try {
    const u = new URL(s);
    if (u.hostname.includes('firebasestorage.googleapis.com')) return true;
    if (u.hostname.endsWith('googleusercontent.com')) return true;
    return false;
  } catch {
    return false;
  }
}
