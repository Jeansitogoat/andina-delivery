/**
 * Geocodifica locales sin lat/lng usando Nominatim.
 * Solo actualiza locales que tienen address pero no lat/lng.
 * Ejecutar: npx tsx scripts/geocode-locales-sin-coords.ts
 * Nominatim: 1 req/s recomendado.
 */
import path from 'path';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../lib/firebase-admin';
import { geocodeAddress } from '../lib/geocoding';

async function main() {
  const db = getAdminFirestore();
  const snap = await db.collection('locales').get();

  const sinCoords: { id: string; address: string }[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    const hasLat = typeof data.lat === 'number' && !Number.isNaN(data.lat);
    const hasLng = typeof data.lng === 'number' && !Number.isNaN(data.lng);
    const address = (data.address ?? '').toString().trim();
    if (!hasLat || !hasLng) {
      if (address) {
        sinCoords.push({ id: d.id, address });
      } else {
        console.log('Omitido (sin address):', d.id, data.name);
      }
    }
  });

  if (sinCoords.length === 0) {
    console.log('Todos los locales tienen coordenadas o no tienen address.');
    return;
  }

  console.log(`${sinCoords.length} locales sin coords a geocodificar...\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < sinCoords.length; i++) {
    const { id, address } = sinCoords[i];
    const result = await geocodeAddress(address);
    if (result) {
      await db.collection('locales').doc(id).update({
        lat: result.lat,
        lng: result.lng,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  OK ${id}: ${address} -> ${result.lat}, ${result.lng}`);
      ok++;
    } else {
      console.log(`  FAIL ${id}: ${address} (no se encontró)`);
      fail++;
    }
    if (i < sinCoords.length - 1) {
      await new Promise((r) => setTimeout(r, 1100)); // 1 req/s
    }
  }

  console.log(`\nListo: ${ok} actualizados, ${fail} fallidos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
