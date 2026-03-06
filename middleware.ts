import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // Por ahora no modificamos la request; este middleware existe
  // principalmente para poder añadir cabeceras de seguridad en el futuro.
}

