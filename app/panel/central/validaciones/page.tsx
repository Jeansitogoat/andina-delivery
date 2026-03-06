'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCheck, Bike, UserX, Loader2, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';

const CENTRAL_NAME = 'Central Virgen de la Merced';

interface RiderRow {
  uid: string;
  email: string | null;
  displayName?: string | null;
  rol: 'rider';
  riderStatus?: string;
}

async function fetchWithAuth(url: string, token: string | null) {
  if (!token) throw new Error('No token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function postWithAuth(url: string, token: string | null) {
  if (!token) throw new Error('No token');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

export default function ValidacionesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<RiderRow[]>([]);
  const [aprobados, setAprobados] = useState<RiderRow[]>([]);
  const [suspendidos, setSuspendidos] = useState<RiderRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [toast, setToast] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.rol !== 'central' && user.rol !== 'maestro')) {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || (user.rol !== 'central' && user.rol !== 'maestro')) return;
    let cancelled = false;
    (async () => {
      const t = await getIdToken();
      if (cancelled || !t) return;
      setToken(t);
      try {
        const [sol, allRiders] = await Promise.all([
          fetchWithAuth('/api/riders/solicitudes', t),
          fetchWithAuth('/api/riders?estado=todos', t),
        ]);
        if (cancelled) return;
        setPendientes(Array.isArray(sol.riders) ? sol.riders : []);
        const riders = Array.isArray(allRiders.riders) ? allRiders.riders : [];
        setAprobados(riders.filter((r: RiderRow) => r.riderStatus === 'approved'));
        setSuspendidos(riders.filter((r: RiderRow) => r.riderStatus === 'suspended'));
      } catch {
        if (!cancelled) setToast('Error al cargar solicitudes');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refresh = async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const [sol, allRiders] = await Promise.all([
        fetchWithAuth('/api/riders/solicitudes', token),
        fetchWithAuth('/api/riders?estado=todos', token),
      ]);
      setPendientes(Array.isArray(sol.riders) ? sol.riders : []);
      const riders = Array.isArray(allRiders.riders) ? allRiders.riders : [];
      setAprobados(riders.filter((r: RiderRow) => r.riderStatus === 'approved'));
      setSuspendidos(riders.filter((r: RiderRow) => r.riderStatus === 'suspended'));
    } catch {
      setToast('Error al actualizar');
    } finally {
      setLoadingList(false);
    }
  };

  const handleValidar = async (uid: string) => {
    if (!token) return;
    setActingId(uid);
    try {
      await postWithAuth(`/api/riders/${uid}/validar`, token);
      setToast('Rider validado');
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Error al validar');
    } finally {
      setActingId(null);
    }
  };

  const handleRechazar = async (uid: string) => {
    if (!token) return;
    setActingId(uid);
    try {
      await postWithAuth(`/api/riders/${uid}/rechazar`, token);
      setToast('Solicitud rechazada');
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Error al rechazar');
    } finally {
      setActingId(null);
    }
  };

  const handleSuspender = async (uid: string) => {
    if (!token) return;
    setActingId(uid);
    try {
      await postWithAuth(`/api/riders/${uid}/suspender`, token);
      setToast('Rider suspendido');
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Error al suspender');
    } finally {
      setActingId(null);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (user.rol !== 'central' && user.rol !== 'maestro') return null;

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-rojo-andino text-white px-5 pt-10 pb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/panel/central')}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-xl">Validaciones de riders</h1>
          <div className="w-9" />
        </div>
        <p className="text-white/80 text-sm mt-1">Aprobar, rechazar o suspender cuentas de riders</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {toast && (
          <div className="rounded-2xl bg-gray-800 text-white px-4 py-3 text-sm font-medium">
            {toast}
          </div>
        )}

        {loadingList ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-rojo-andino animate-spin" />
          </div>
        ) : (
          <>
            {/* Pendientes */}
            <section>
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                <UserCheck className="w-5 h-5 text-amber-500" />
                Solicitudes pendientes ({pendientes.length})
              </h2>
              {pendientes.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                  <p className="text-gray-500">No hay solicitudes pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendientes.map((r) => (
                    <div
                      key={r.uid}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{r.displayName || 'Sin nombre'}</p>
                        <p className="text-sm text-gray-500">{r.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actingId === r.uid}
                          onClick={() => handleValidar(r.uid)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-bold"
                        >
                          {actingId === r.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Validar
                        </button>
                        <button
                          type="button"
                          disabled={actingId === r.uid}
                          onClick={() => handleRechazar(r.uid)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold"
                        >
                          {actingId === r.uid ? null : <XCircle className="w-4 h-4" />}
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Aprobados */}
            <section>
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Bike className="w-5 h-5 text-green-600" />
                Riders aprobados ({aprobados.length})
              </h2>
              {aprobados.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                  <p className="text-gray-500">No hay riders aprobados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aprobados.map((r) => (
                    <div
                      key={r.uid}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{r.displayName || 'Sin nombre'}</p>
                        <p className="text-sm text-gray-500">{r.email}</p>
                      </div>
                      <button
                        type="button"
                        disabled={actingId === r.uid}
                        onClick={() => handleSuspender(r.uid)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-bold"
                      >
                        {actingId === r.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        Suspender
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Suspendidos */}
            <section>
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                <UserX className="w-5 h-5 text-gray-500" />
                Cuentas suspendidas ({suspendidos.length})
              </h2>
              {suspendidos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                  <p className="text-gray-500">Ninguna cuenta suspendida</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suspendidos.map((r) => (
                    <div
                      key={r.uid}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-75"
                    >
                      <p className="font-bold text-gray-900">{r.displayName || 'Sin nombre'}</p>
                      <p className="text-sm text-gray-500">{r.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
