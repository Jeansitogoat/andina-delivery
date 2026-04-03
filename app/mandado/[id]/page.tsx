'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  Zap,
  MapPin,
  Phone,
  Truck,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  XCircle,
} from 'lucide-react';
import { getFirestoreDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import { docToMandadoCentral } from '@/lib/mandado-map';
import type { MandadoCentral, EstadoMandado } from '@/lib/types';
import { formatWhatsAppLink } from '@/lib/utils/phone';
import { formatDistanceKm } from '@/lib/geo';
import { getIdToken } from '@/lib/authToken';

const WHATSAPP_CENTRAL = '593992250333';

function estadoLabel(e: EstadoMandado): { title: string; sub: string; step: number } {
  switch (e) {
    case 'pendiente':
      return { title: 'Buscando socio', sub: 'Central asignará un motorizado a tu mandado.', step: 1 };
    case 'asignado':
      return { title: 'Socio asignado', sub: 'Tu mandado tiene rider. En breve va en camino.', step: 2 };
    case 'en_camino':
      return { title: 'En camino', sub: 'El motorizado está realizando tu mandado.', step: 3 };
    case 'completado':
      return { title: 'Completado', sub: 'Gracias por usar Andina Mandados.', step: 4 };
    case 'cancelado':
      return { title: 'Cancelado', sub: 'Este mandado fue cancelado.', step: 0 };
    default:
      return { title: 'Mandado', sub: '', step: 0 };
  }
}

export default function MandadoSeguimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mandado, setMandado] = useState<MandadoCentral | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?redirect=/mandado/${encodeURIComponent(id)}`);
      return;
    }
    if (user.rol !== 'cliente') {
      router.replace('/');
      return;
    }

    const db = getFirestoreDb();
    const ref = doc(db, 'mandados', id);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          setMandado(null);
          return;
        }
        const m = docToMandadoCentral(snap.id, snap.data()!);
        if (m.clienteId !== user.uid) {
          setLoadError('No tienes acceso a este mandado.');
          setMandado(null);
          return;
        }
        setNotFound(false);
        setLoadError(null);
        setMandado(m);
      },
      (err) => {
        console.error('[mandado] onSnapshot', err);
        setLoadError('No se pudo cargar el seguimiento. Intenta de nuevo.');
      }
    );

    return () => unsub();
  }, [authLoading, user, id, router]);

  const cfg = mandado ? estadoLabel(mandado.estado) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-white pb-28">
      <header className="sticky top-0 z-20 bg-dorado-oro border-b border-amber-400/30 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-black/10 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div>
          <h1 className="font-black text-gray-900 text-sm">Tu mandado</h1>
          <p className="text-[11px] text-gray-800/80">Seguimiento en vivo</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {authLoading || (!mandado && !notFound && !loadError) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-dorado-oro animate-spin" />
            <p className="text-sm text-gray-500">Cargando…</p>
          </div>
        ) : notFound ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-gray-700 font-semibold">No encontramos este mandado.</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm"
            >
              Volver al inicio
            </button>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 rounded-2xl border border-red-100 p-6 text-center">
            <p className="text-red-800 text-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm"
            >
              Volver al inicio
            </button>
          </div>
        ) : mandado && cfg ? (
          <>
            <div className="w-16 h-16 rounded-full bg-dorado-oro/20 flex items-center justify-center mx-auto mb-4">
              <div className="w-12 h-12 rounded-full bg-dorado-oro flex items-center justify-center">
                <Zap className="w-6 h-6 text-gray-900" />
              </div>
            </div>
            <h2 className="text-center font-black text-xl text-gray-900 mb-1">{cfg.title}</h2>
            <p className="text-center text-sm text-gray-600 mb-6">{cfg.sub}</p>

            {mandado.estado !== 'cancelado' && mandado.estado !== 'completado' ? (
              <div className="flex items-center justify-center gap-2 bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl py-3 px-4 mb-6">
                <Clock className="w-4 h-4 text-dorado-oro" />
                <span className="text-sm font-semibold text-gray-800">
                  Tiempo orientativo: <span className="text-rojo-andino font-black">15-30 min</span>
                </span>
              </div>
            ) : null}

            {/* Pasos visuales */}
            <div className="flex justify-between items-center mb-8 px-1">
              {[
                { n: 1, ok: cfg.step >= 1 && mandado.estado !== 'cancelado' },
                { n: 2, ok: cfg.step >= 2 && mandado.estado !== 'cancelado' },
                { n: 3, ok: cfg.step >= 3 && mandado.estado !== 'cancelado' },
                { n: 4, ok: mandado.estado === 'completado' },
              ].map((s, i) => (
                <div key={s.n} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      s.ok ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s.ok ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                  </div>
                  {i < 3 ? <div className="h-0.5 flex-1 w-full bg-gray-200 -mx-1 mt-4 hidden sm:block" /> : null}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-dorado-oro/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Mandado</p>
                  <p className="text-sm font-semibold text-gray-800">{mandado.descripcion}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-dorado-oro/15 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Desde</p>
                  <p className="text-sm font-semibold text-gray-800">{mandado.desdeTexto}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-rojo-andino" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Hasta</p>
                  <p className="text-sm font-semibold text-gray-800">{mandado.hastaTexto}</p>
                </div>
              </div>
              {mandado.tarifaEnvio != null ? (
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Carrera estimada</p>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">${mandado.tarifaEnvio.toFixed(2)}</p>
                    {mandado.distanciaKm != null ? (
                      <p className="text-[11px] text-gray-400">{formatDistanceKm(mandado.distanciaKm)}</p>
                    ) : (
                      <p className="text-[11px] text-gray-400">Sin distancia GPS (tarifa mínima)</p>
                    )}
                    {mandado.pagoRider != null ? (
                      <p className="text-[11px] text-gray-500 mt-0.5">Pago rider ref. ${mandado.pagoRider.toFixed(2)}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {mandado.riderNombre && mandado.estado !== 'pendiente' ? (
              <div className="flex items-center gap-3 bg-rojo-andino/5 border border-rojo-andino/15 rounded-2xl p-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-rojo-andino" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">Cía. Virgen de la Merced</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {mandado.riderNombre} ·{' '}
                    {mandado.estado === 'en_camino' ? 'En camino' : 'Asignado'}
                  </p>
                </div>
              </div>
            ) : null}

            <a
              href={`${formatWhatsAppLink(WHATSAPP_CENTRAL)}?text=${encodeURIComponent(
                `Hola, consulto mi mandado ${mandado.id}: ${mandado.descripcion}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm mb-3 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Contactar central · WhatsApp
            </a>

            {mandado.estado === 'pendiente' ? (
              <button
                type="button"
                onClick={async () => {
                  const tok = await getIdToken();
                  if (!tok) return;
                  await fetch(`/api/mandados/${mandado.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                    body: JSON.stringify({ accion: 'cancelar_cliente' }),
                  });
                }}
                className="w-full py-3 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 mb-3"
              >
                Cancelar solicitud
              </button>
            ) : null}

            {mandado.estado === 'cancelado' ? (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-xl p-3 text-sm mb-3">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                Este mandado fue cancelado.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm"
            >
              Volver al inicio
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
