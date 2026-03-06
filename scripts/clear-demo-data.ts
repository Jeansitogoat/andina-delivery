/**
 * Vacía los datos demo para dejar la app lista para datos reales (día del lanzamiento).
 * Ejecutar: npx tsx scripts/clear-demo-data.ts  (o npm run seed:clear)
 * Después: cargar negocios reales en data/locales-aprobados.json (o vía panel) y pedidos/riders reales si aplica.
 */
import fs from 'fs/promises';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOCALES_FILE = path.join(DATA_DIR, 'locales-aprobados.json');
const CENTRAL_FILE = path.join(DATA_DIR, 'central.json');
const RIDER_FILE = path.join(DATA_DIR, 'rider.json');

const EMPTY_LOCALES = { locales: [], menus: {}, reviews: {} };
const EMPTY_CENTRAL = { pedidos: [], riders: [] };
const EMPTY_RIDER = { carreras: [], historial: [] };

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCALES_FILE, JSON.stringify(EMPTY_LOCALES, null, 2), 'utf-8');
  await fs.writeFile(CENTRAL_FILE, JSON.stringify(EMPTY_CENTRAL, null, 2), 'utf-8');
  await fs.writeFile(RIDER_FILE, JSON.stringify(EMPTY_RIDER, null, 2), 'utf-8');
  console.log('Datos demo vaciados. App lista para cargar datos reales.');
  console.log('  ', LOCALES_FILE);
  console.log('  ', CENTRAL_FILE);
  console.log('  ', RIDER_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
