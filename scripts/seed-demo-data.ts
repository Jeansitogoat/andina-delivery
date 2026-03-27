/**
 * Seed de datos demo en data/ (locales-aprobados, central, rider).
 * Ejecutar: npx tsx scripts/seed-demo-data.ts  (o npm run seed)
 * El dÃ­a del lanzamiento: vaciar o reemplazar los JSON en data/ con datos reales.
 */
import fs from 'fs/promises';
import path from 'path';
import { locales, MENUS, REVIEWS } from '../lib/data';
import type { LocalesAprobadosFile } from '../lib/socios-types';
import type { PedidoCentral, RiderCentral, CarreraRider } from '../lib/types';

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOCALES_FILE = path.join(DATA_DIR, 'locales-aprobados.json');
const CENTRAL_FILE = path.join(DATA_DIR, 'central.json');
const RIDER_FILE = path.join(DATA_DIR, 'rider.json');

const PEDIDOS_DEMO: PedidoCentral[] = [
  { id: 'P001', restaurante: 'RincÃ³n del Sabor', restauranteDireccion: 'Av. 9 de Octubre y Sucre', clienteNombre: 'Ana Torres', clienteDireccion: 'Calle Pichincha #45, PiÃ±as', clienteTelefono: '+593987654321', items: ['1Ã— Seco de Pollo', '1Ã— Jugo de naranja'], total: 9.5, estado: 'esperando_rider', riderId: null, hora: '14:35', timestamp: Date.now() - 180000, distancia: '1.2 km' },
  { id: 'P002', restaurante: 'Grill 51 Fast Food', restauranteDireccion: 'Calle 9 de Octubre, PiÃ±as', clienteNombre: 'Luis Mendoza', clienteDireccion: 'Urb. Los Pinos, Casa 12', clienteTelefono: '+593998877665', items: ['2Ã— Hamburguesa Classic', '2Ã— Gaseosa'], total: 11.0, estado: 'asignado', riderId: 'r1', hora: '14:20', timestamp: Date.now() - 900000, distancia: '0.8 km' },
  { id: 'P003', restaurante: 'Julieta Wines & Coffee', restauranteDireccion: 'Parque Central, PiÃ±as', clienteNombre: 'MarÃ­a Salinas', clienteDireccion: 'Av. Los Ceibos, PiÃ±as', clienteTelefono: '+593991234567', items: ['1Ã— Latte Grande', '2Ã— Croissant'], total: 7.5, estado: 'en_camino', riderId: 'r3', hora: '14:10', timestamp: Date.now() - 1500000, distancia: '1.5 km' },
  { id: 'P004', restaurante: 'RHK Asadero', restauranteDireccion: 'Sector La Cadena, PiÃ±as', clienteNombre: 'Pedro GÃ³mez', clienteDireccion: 'Barrio La Esperanza', clienteTelefono: '+593987001122', items: ['1Ã— Pollo a la brasa entero'], total: 14.0, estado: 'esperando_rider', riderId: null, hora: '14:38', timestamp: Date.now() - 60000, distancia: '2.1 km' },
  { id: 'P005', restaurante: 'RincÃ³n del Sabor', restauranteDireccion: 'Av. 9 de Octubre y Sucre', clienteNombre: 'Carlos RÃ­os', clienteDireccion: 'Sector El ParaÃ­so', clienteTelefono: '+593976543210', items: ['2Ã— Caldo de gallina', '1Ã— Arroz con leche'], total: 8.0, estado: 'entregado', riderId: 'r2', hora: '13:50', timestamp: Date.now() - 2700000, distancia: '3.0 km' },
];

const RIDERS_DEMO: RiderCentral[] = [
  { id: 'r1', nombre: 'Carlos M.', inicial: 'C', telefono: '+593987111222', estado: 'disponible', carrerasHoy: 5, calificacion: 4.8, color: 'bg-blue-500' },
  { id: 'r2', nombre: 'Diego F.', inicial: 'D', telefono: '+593987333444', estado: 'disponible', carrerasHoy: 3, calificacion: 4.6, color: 'bg-purple-500' },
  { id: 'r3', nombre: 'Marcos T.', inicial: 'M', telefono: '+593987555666', estado: 'ocupado', carrerasHoy: 7, calificacion: 4.9, color: 'bg-green-500' },
  { id: 'r4', nombre: 'AndrÃ©s P.', inicial: 'A', telefono: '+593987777888', estado: 'disponible', carrerasHoy: 2, calificacion: 4.5, color: 'bg-orange-500' },
  { id: 'r5', nombre: 'Luis S.', inicial: 'L', telefono: '+593987999000', estado: 'fuera_servicio', carrerasHoy: 0, calificacion: 4.7, color: 'bg-red-500' },
];

const CARRERAS_DEMO: CarreraRider[] = [
  { id: 'c001', pedidoId: 'A87654321', restaurante: 'RincÃ³n del Sabor', restauranteDireccion: 'Av. 9 de Octubre y Sucre', clienteNombre: 'Ana Torres', clienteDireccion: 'Calle Pichincha #45, PiÃ±as', clienteTelefono: '+593987654321', total: 12.5, propina: 1.0, codigoVerificacion: '874321', estado: 'asignada', hora: '14:32', distancia: '1.2 km', items: ['1Ã— Seco de Pollo', '1Ã— Jugo de naranja', '1Ã— Arroz extra'] },
  { id: 'c002', pedidoId: 'A12398765', restaurante: 'Grill 51 Fast Food', restauranteDireccion: 'Calle 9 de Octubre, PiÃ±as', clienteNombre: 'Luis Mendoza', clienteDireccion: 'Urb. Los Pinos, Casa 12', clienteTelefono: '+593998877665', total: 9.0, propina: 0.5, codigoVerificacion: '123987', estado: 'en_camino', hora: '14:15', distancia: '0.8 km', items: ['2Ã— Hamburguesa Grill Classic', '2Ã— Gaseosa 500ml'] },
];

const HISTORIAL_DEMO: CarreraRider[] = [
  { id: 'h001', pedidoId: 'A00011111', restaurante: 'RincÃ³n del Sabor', restauranteDireccion: '', clienteNombre: 'Pedro GÃ³mez', clienteDireccion: 'Barrio La Esperanza', clienteTelefono: '', total: 8.5, propina: 1.5, codigoVerificacion: '', estado: 'entregada', hora: '11:20', distancia: '1.5 km', items: ['1Ã— Caldo de res'] },
  { id: 'h002', pedidoId: 'A00022222', restaurante: 'Grill 51 Fast Food', restauranteDireccion: '', clienteNombre: 'MarÃ­a Salinas', clienteDireccion: 'Av. Los Ceibos', clienteTelefono: '', total: 11.0, propina: 1.0, codigoVerificacion: '', estado: 'entregada', hora: '12:45', distancia: '2.1 km', items: ['2Ã— Combo BBQ Smoke'] },
  { id: 'h003', pedidoId: 'A00033333', restaurante: 'Andina Express', restauranteDireccion: '', clienteNombre: 'Carlos RÃ­os', clienteDireccion: 'Sector El ParaÃ­so', clienteTelefono: '', total: 5.0, propina: 0.0, codigoVerificacion: '', estado: 'entregada', hora: '13:30', distancia: '3.0 km', items: ['Mandado: Farmacia Cruz Roja'] },
];

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const localesPayload: LocalesAprobadosFile = {
    locales,
    menus: MENUS,
    reviews: REVIEWS,
  };
  await fs.writeFile(LOCALES_FILE, JSON.stringify(localesPayload, null, 2), 'utf-8');
  console.log('Seed OK:', LOCALES_FILE);
  console.log('  locales:', localesPayload.locales.length, 'menus:', Object.keys(localesPayload.menus).length, 'reviews:', localesPayload.reviews ? Object.keys(localesPayload.reviews).length : 0);

  await fs.writeFile(CENTRAL_FILE, JSON.stringify({ pedidos: PEDIDOS_DEMO, riders: RIDERS_DEMO }, null, 2), 'utf-8');
  console.log('Seed OK:', CENTRAL_FILE);

  await fs.writeFile(RIDER_FILE, JSON.stringify({ carreras: CARRERAS_DEMO, historial: HISTORIAL_DEMO }, null, 2), 'utf-8');
  console.log('Seed OK:', RIDER_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

