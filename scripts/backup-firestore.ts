import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Query } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function backupCollection(name: string, limitDocs?: number) {
  const db = getAdminFirestore();
  let ref: Query = db.collection(name);
  if (typeof limitDocs === 'number' && limitDocs > 0) {
    ref = ref.limit(limitDocs);
  }
  const snap = await ref.get();
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return data;
}

async function main() {
  const date = new Date();
  const iso = date.toISOString().slice(0, 10);
  const baseDir = join(process.cwd(), 'backups', iso);
  mkdirSync(baseDir, { recursive: true });

  const payload: Record<string, unknown> = {};

  payload.config = await backupCollection('config');
  payload.locales = await backupCollection('locales');
  // Pedidos puede ser muy grande; limitar al rango reciente para backups rápidos.
  payload.pedidos_recent = await backupCollection('pedidos', 500);

  const filePath = join(baseDir, 'backup.json');
  writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log('Backup escrito en', filePath);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error en backup-firestore:', err);
  process.exit(1);
});

