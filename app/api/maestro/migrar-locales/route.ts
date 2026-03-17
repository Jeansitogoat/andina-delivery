import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import type { Local, MenuItem } from '@/lib/data';
import type { LocalesAprobadosFile } from '@/lib/socios-types';
import { requireAuth } from '@/lib/api-auth';
import { setLocalInFirestore } from '@/lib/locales-firestore';

const LOCALES_APROBADOS_PATH = path.join(process.cwd(), 'data', 'locales-aprobados.json');

async function readLocalesFromFile(): Promise<LocalesAprobadosFile> {
  try {
    const raw = await fs.readFile(LOCALES_APROBADOS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { locales: [], menus: {}, reviews: {} };
    throw e;
  }
}

/** POST /api/maestro/migrar-locales → migra locales y menús del archivo JSON a Firestore (una sola vez). */
export async function POST(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const file = await readLocalesFromFile();
    const locales = file.locales || [];
    const menus = file.menus || {};
    let migrated = 0;

    for (const loc of locales) {
      const local: Local = {
        id: loc.id,
        name: loc.name,
        rating: loc.rating ?? 4.5,
        reviews: loc.reviews ?? 0,
        time: loc.time ?? '20-35 min',
        shipping: loc.shipping ?? 1.5,
        type: Array.isArray(loc.type) ? loc.type : ['Restaurantes'],
        distance: loc.distance ?? '—',
        destacado: Boolean(loc.destacado),
        logo: loc.logo ?? '',
        cover: loc.cover ?? '',
        address: loc.address,
        minOrder: loc.minOrder,
        categories: Array.isArray(loc.categories) ? loc.categories : ['Más pedidos'],
        status: loc.status === 'suspended' ? 'suspended' : 'active',
        telefono: loc.telefono,
        horarios: loc.horarios,
        transferencia: loc.transferencia,
      };
      const menu: MenuItem[] = Array.isArray(menus[loc.id]) ? menus[loc.id] : [];
      await setLocalInFirestore(local.id, local, menu);
      migrated++;
    }

    return NextResponse.json({ ok: true, migrated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al migrar locales';
    console.error('POST /api/maestro/migrar-locales', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
