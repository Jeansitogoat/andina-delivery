/**
 * Contacto único de Central / Logística para coordinación con locales (llamada + WhatsApp).
 * Override con NEXT_PUBLIC_CENTRAL_LOGISTICA_PHONE (solo dígitos, ej. 593992250333).
 */
export const CENTRAL_LOGISTICA_PHONE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CENTRAL_LOGISTICA_PHONE
    ? String(process.env.NEXT_PUBLIC_CENTRAL_LOGISTICA_PHONE).replace(/\D/g, '')
    : '593992250333';
