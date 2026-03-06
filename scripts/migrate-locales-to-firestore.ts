/**
 * Migra locales de data/locales-aprobados.json a Firestore.
 * Si existe data/locales-overrides.json, aplica los overrides de transferencia antes de guardar.
 * Carga .env.local para usar FIREBASE_SERVICE_ACCOUNT_*.
 * Ejecutar: npm run migrate:locales
 */
import path from 'path';
import fs from 'fs/promises';

// Cargar .env.local para credenciales de Firebase (desde la raíz del proyecto)
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
import type { Local, MenuItem, TransferenciaLocal } from '../lib/data';
import type { LocalesAprobadosFile } from '../lib/socios-types';
import { setLocalInFirestore } from '../lib/locales-firestore';

const ROOT = path.join(__dirname, '..');
const LOCALES_FILE = path.join(ROOT, 'data', 'locales-aprobados.json');
const OVERRIDES_FILE = path.join(ROOT, 'data', 'locales-overrides.json');

type OverridesFile = Record<string, { transferencia?: TransferenciaLocal | null }>;

async function readOverrides(): Promise<OverridesFile> {
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, 'utf-8');
    return JSON.parse(raw) as OverridesFile;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

function applyOverrides(loc: Local, ov?: OverridesFile[string]): Local {
  if (!ov || ov.transferencia === undefined) return loc;
  if (ov.transferencia === null) return { ...loc, transferencia: undefined };
  return { ...loc, transferencia: ov.transferencia };
}

async function main() {
  let raw: string;
  try {
    raw = await fs.readFile(LOCALES_FILE, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('No existe data/locales-aprobados.json. Ejecuta primero: npm run seed');
      process.exit(1);
    }
    throw e;
  }

  const data = JSON.parse(raw) as LocalesAprobadosFile;
  const locales: Local[] = data.locales || [];
  const menus: Record<string, MenuItem[]> = data.menus || {};

  if (locales.length === 0) {
    console.log('No hay locales para migrar.');
    return;
  }

  const overrides = await readOverrides();
  let ok = 0;
  let err = 0;

  for (const loc of locales) {
    const local = applyOverrides(loc, overrides[loc.id]);
    try {
      await setLocalInFirestore(local.id, local, menus[local.id] ?? []);
      ok++;
      console.log('  OK:', local.id, local.name);
    } catch (e) {
      err++;
      console.error('  ERROR:', local.id, (e as Error).message);
    }
  }

  console.log('\nMigración completada:', ok, 'OK,', err, 'errores');
  if (err > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
