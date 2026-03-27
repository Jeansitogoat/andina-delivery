import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

/** El panel central usa Firestore `onSnapshot` en el cliente; este GET se mantiene por compatibilidad. */
export async function GET(request: Request) {
  try {
    await requireAuth(request, ['central', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  return NextResponse.json({
    pedidos: [],
    riders: [],
    _note: 'Datos en tiempo real vía Firestore en el panel; no usar este endpoint para la UI.',
  });
}
